"""
ML Prediction Engine — SCRB CrimeIntel
=======================================
Replaces random/heuristic forecasting with real ML models:

  - LinearRegression  : district-level monthly crime volume trend
  - GradientBoosting  : 6-month crime-type forecast per district
  - IsolationForest   : anomaly detection (crime spikes)
  - Moving-average    : smoothed baseline for confidence intervals

All models are trained on the live crimes table each time the
/ml/* endpoints are called (no persistence needed for a demo —
the DB itself is the source of truth).
"""

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import text
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import GradientBoostingRegressor, IsolationForest
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error
import warnings
warnings.filterwarnings("ignore")


# ─── helpers ─────────────────────────────────────────────────────────────────

def load_monthly_series(db: Session) -> pd.DataFrame:
    """Return monthly crime counts per district+crime_type from DB."""
    result = db.execute(text(
        "SELECT year, month, district, crime_type, COUNT(*) as total "
        "FROM crimes GROUP BY year, month, district, crime_type "
        "ORDER BY year, month"
    ))
    rows = result.fetchall()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["year", "month", "district", "crime_type", "total"])
    df["period"] = df["year"] * 12 + df["month"]  # numeric time axis
    return df


def severity_from_count(predicted: float, p75: float, p90: float) -> str:
    if predicted >= p90:
        return "Critical"
    elif predicted >= p75:
        return "Warning"
    else:
        return "Normal"


def confidence_from_mae(mae: float, mean_val: float) -> float:
    """Higher relative accuracy → higher confidence."""
    if mean_val == 0:
        return 0.70
    rel_err = mae / (mean_val + 1e-6)
    conf = max(0.55, min(0.97, 1.0 - rel_err))
    return round(conf, 3)


# ─── 1. District-level 6-month ML forecast ───────────────────────────────────

def ml_forecast_district(db: Session, district: str) -> dict:
    """
    Trains a GradientBoosting model on historical monthly crime counts
    for the given district and forecasts the next 6 months.
    """
    df = load_monthly_series(db)
    if df.empty:
        return {"district": district, "forecast": [], "model": "fallback"}

    dist_df = df[df["district"] == district].groupby("period")["total"].sum().reset_index()
    if len(dist_df) < 12:
        # Fallback projection when data is insufficient for Gradient Boosting
        mean_val = float(dist_df["total"].mean()) if not dist_df.empty else 10.0
        conf = 0.60
        forecasts = []
        last_period = int(dist_df["period"].iloc[-1]) if not dist_df.empty else 2024 * 12 + 12
        for i in range(1, 7):
            next_period = last_period + i
            month_num = ((next_period - 1) % 12) + 1
            period_label = f"2025-{month_num:02d}"
            std_err = max(1.0, mean_val * 0.3)
            forecasts.append({
                "month": period_label,
                "predicted": int(round(mean_val)),
                "lower_bound": max(0, int(round(mean_val - std_err))),
                "upper_bound": int(round(mean_val + std_err)),
                "confidence": conf,
                "severity": "Normal",
            })
        return {
            "district": district,
            "model": "FallbackMovingAverage",
            "mae": 0.0,
            "confidence": conf,
            "historical_mean": round(mean_val, 1),
            "forecast": forecasts,
        }

    # Feature engineering: lag features + rolling mean
    dist_df = dist_df.sort_values("period").reset_index(drop=True)
    dist_df["lag1"]  = dist_df["total"].shift(1)
    dist_df["lag2"]  = dist_df["total"].shift(2)
    dist_df["lag3"]  = dist_df["total"].shift(3)
    dist_df["lag6"]  = dist_df["total"].shift(6)
    dist_df["roll3"] = dist_df["total"].rolling(3).mean()
    dist_df["roll6"] = dist_df["total"].rolling(6).mean()
    dist_df["month_of_year"] = ((dist_df["period"] - 1) % 12) + 1
    dist_df = dist_df.dropna()

    FEATURES = ["period", "lag1", "lag2", "lag3", "lag6", "roll3", "roll6", "month_of_year"]
    X = dist_df[FEATURES].values
    y = dist_df["total"].values

    model = GradientBoostingRegressor(
        n_estimators=120, learning_rate=0.08, max_depth=4,
        subsample=0.85, random_state=42
    )
    # Rolling cross-validation for MAE estimate
    if len(X) >= 8:
        split = int(len(X) * 0.8)
        model.fit(X[:split], y[:split])
        y_pred_cv = model.predict(X[split:])
        mae = mean_absolute_error(y[split:], y_pred_cv)
    else:
        mae = 0
    model.fit(X, y)  # Re-fit on full data

    mean_val = float(np.mean(y[-12:]))
    conf = confidence_from_mae(mae, mean_val)
    p75 = float(np.percentile(y, 75))
    p90 = float(np.percentile(y, 90))

    # Forecast next 6 months iteratively
    last_period = int(dist_df["period"].iloc[-1])
    last_vals   = list(dist_df["total"].values[-6:])
    forecasts   = []

    for i in range(1, 7):
        next_period = last_period + i
        month_of_year = ((next_period - 1) % 12) + 1
        lag1  = last_vals[-1]  if len(last_vals) >= 1 else mean_val
        lag2  = last_vals[-2]  if len(last_vals) >= 2 else mean_val
        lag3  = last_vals[-3]  if len(last_vals) >= 3 else mean_val
        lag6  = last_vals[-6]  if len(last_vals) >= 6 else mean_val
        roll3 = np.mean(last_vals[-3:]) if len(last_vals) >= 3 else mean_val
        roll6 = np.mean(last_vals[-6:]) if len(last_vals) >= 6 else mean_val

        X_pred = np.array([[next_period, lag1, lag2, lag3, lag6, roll3, roll6, month_of_year]])
        predicted = float(model.predict(X_pred)[0])
        predicted = max(0, predicted)

        year_offset  = (next_period - 1) // 12
        month_num    = ((next_period - 1) % 12) + 1
        # Map from numeric year back (data starts at 2018 = year*12+1)
        base_year = 2018
        actual_year = base_year + (next_period - (2018 * 12 + 1)) // 12
        actual_year = 2025  # hardcoded 2025 forecast window
        period_label = f"2025-{month_num:02d}"

        std_err = mae * 1.5
        forecasts.append({
            "month": period_label,
            "predicted": int(round(predicted)),
            "lower_bound": max(0, int(round(predicted - std_err))),
            "upper_bound": int(round(predicted + std_err)),
            "confidence": conf,
            "severity": severity_from_count(predicted, p75, p90),
        })
        last_vals.append(predicted)

    return {
        "district": district,
        "model": "GradientBoostingRegressor",
        "mae": round(mae, 2),
        "confidence": conf,
        "historical_mean": round(mean_val, 1),
        "forecast": forecasts,
    }


# ─── 2. Karnataka-wide top-district crime forecast ───────────────────────────

def ml_top_district_forecasts(db: Session, top_n: int = 10) -> list:
    """
    Trains a LinearRegression trend model per district to forecast
    total crimes next month and rank districts by predicted volume.
    """
    df = load_monthly_series(db)
    if df.empty:
        return []

    agg = df.groupby(["period", "district"])["total"].sum().reset_index()
    districts = agg["district"].unique()
    results   = []

    for dist in districts:
        sub = agg[agg["district"] == dist].sort_values("period")
        if len(sub) < 6:
            continue

        X = sub["period"].values.reshape(-1, 1)
        y = sub["total"].values
        ridge = Ridge(alpha=1.0)
        ridge.fit(X, y)

        next_period = int(sub["period"].iloc[-1]) + 1
        predicted   = max(0, float(ridge.predict([[next_period]])[0]))
        trend_slope = float(ridge.coef_[0])
        trend_label = "Rising" if trend_slope > 0.5 else ("Falling" if trend_slope < -0.5 else "Stable")

        last_12     = y[-12:]
        mean_val    = float(np.mean(last_12))
        p75 = float(np.percentile(y, 75))
        p90 = float(np.percentile(y, 90))

        # R² as a proxy for confidence
        ss_res = np.sum((y - ridge.predict(X)) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r2 = max(0.0, 1 - ss_res / (ss_tot + 1e-9))
        conf = round(0.55 + r2 * 0.40, 3)

        results.append({
            "district":        dist,
            "predicted_next_month": int(round(predicted)),
            "trend":           trend_label,
            "trend_slope":     round(trend_slope, 3),
            "confidence":      min(0.97, conf),
            "severity":        severity_from_count(predicted, p75, p90),
            "historical_mean": round(mean_val, 1),
            "model":           "Ridge",
        })

    results.sort(key=lambda x: x["predicted_next_month"], reverse=True)
    return results[:top_n]


# ─── 3. Anomaly / Spike Detection ────────────────────────────────────────────

def detect_crime_spikes(db: Session) -> list:
    """
    Uses IsolationForest to find district-month combinations with
    anomalously high crime counts (potential crisis events).
    """
    df = load_monthly_series(db)
    if df.empty:
        return []

    agg = df.groupby(["year", "month", "district"])["total"].sum().reset_index()
    if len(agg) < 20:
        return []

    le = LabelEncoder()
    agg["district_enc"] = le.fit_transform(agg["district"])

    features = agg[["year", "month", "district_enc", "total"]].values
    iso = IsolationForest(contamination=0.05, random_state=42, n_estimators=100)
    agg["anomaly_score"] = iso.fit_predict(features)
    agg["raw_score"]     = iso.score_samples(features)

    # anomaly_score == -1 means outlier (spike)
    spikes = agg[agg["anomaly_score"] == -1].sort_values("raw_score").head(15)
    return [{
        "district":    row["district"],
        "year":        int(row["year"]),
        "month":       int(row["month"]),
        "crime_count": int(row["total"]),
        "anomaly_score": round(float(row["raw_score"]), 4),
        "period":      f"{int(row['year'])}-{int(row['month']):02d}",
    } for _, row in spikes.iterrows()]


# ─── 4. Crime-type breakdown ML forecast for a district ──────────────────────

def ml_crime_type_forecast(db: Session, district: str) -> list:
    """
    Trains a simple trend model per crime_type within a district and
    returns the predicted count + confidence for next month per type.
    """
    df = load_monthly_series(db)
    if df.empty:
        return []

    dist_df = df[df["district"] == district]
    if dist_df.empty:
        return []

    crime_types = dist_df["crime_type"].unique()
    results = []

    for ct in crime_types:
        sub = dist_df[dist_df["crime_type"] == ct].groupby("period")["total"].sum().reset_index()
        sub = sub.sort_values("period")
        if len(sub) < 4:
            continue

        X = sub["period"].values.reshape(-1, 1)
        y = sub["total"].values.astype(float)
        model = LinearRegression()
        model.fit(X, y)

        next_period = int(sub["period"].iloc[-1]) + 1
        predicted   = max(0, float(model.predict([[next_period]])[0]))
        slope       = float(model.coef_[0])
        trend       = "Rising" if slope > 0.1 else ("Falling" if slope < -0.1 else "Stable")
        mean_val    = float(np.mean(y))
        p90         = float(np.percentile(y, 90))

        results.append({
            "crime_type":  ct,
            "predicted":   int(round(predicted)),
            "trend":       trend,
            "mean_hist":   round(mean_val, 1),
            "is_high":     predicted >= p90,
            "confidence":  round(min(0.95, 0.65 + abs(slope) / (mean_val + 1)), 3),
        })

    results.sort(key=lambda x: x["predicted"], reverse=True)
    return results
