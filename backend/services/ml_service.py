"""
ML Prediction Engine — SCRB CrimeIntel
=======================================
Implements a persistent, self-training ML pipeline:
  - GradientBoostingRegressor : 6-month crime volume forecasts
  - Ridge Regression         : District crime next-month rankings
  - IsolationForest          : Crime spike anomaly alerts
  - LinearRegression         : Crime type sub-category forecasts

Models are trained in the background on data change or startup,
and serialized as pickle files. Inference loaded from disk takes <5ms.
"""

import os, pickle, warnings
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import text
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import GradientBoostingRegressor, IsolationForest
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error

warnings.filterwarnings("ignore")

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ─── caching helpers ─────────────────────────────────────────────────────────

def save_model(name: str, data: any):
    try:
        path = os.path.join(MODELS_DIR, f"{name}.pkl")
        with open(path, "wb") as f:
            pickle.dump(data, f)
    except Exception as e:
        print(f"Error saving model {name}: {e}")

def load_model(name: str) -> any:
    try:
        path = os.path.join(MODELS_DIR, f"{name}.pkl")
        if os.path.exists(path):
            with open(path, "rb") as f:
                return pickle.load(f)
    except Exception as e:
        pass
    return None

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
    df["period"] = df["year"] * 12 + df["month"]
    return df

def severity_from_count(predicted: float, p75: float, p90: float) -> str:
    if predicted >= p90:
        return "Critical"
    elif predicted >= p75:
        return "Warning"
    else:
        return "Normal"

def confidence_from_mae(mae: float, mean_val: float) -> float:
    if mean_val == 0:
        return 0.70
    rel_err = mae / (mean_val + 1e-6)
    conf = max(0.55, min(0.97, 1.0 - rel_err))
    return round(conf, 3)

# ─── 1. District 6-month forecast (Gradient Boosting) ─────────────────────────

def ml_forecast_district(db: Session, district: str) -> dict:
    df = load_monthly_series(db)
    if df.empty:
        return {"district": district, "forecast": [], "model": "fallback"}

    dist_df = df[df["district"] == district].groupby("period")["total"].sum().reset_index()
    if len(dist_df) < 12:
        return _forecast_fallback(district, dist_df)

    dist_df = dist_df.sort_values("period").reset_index(drop=True)
    mean_val = float(np.mean(dist_df["total"].values[-12:]))

    # Try loading cached pre-trained model
    cached = load_model(f"gb_{district}")
    if cached:
        model, conf, cached_mean, mae, p75, p90, FEATURES = cached
    else:
        # Train on-the-fly fallback if cache is missing
        dist_df["lag1"]  = dist_df["total"].shift(1)
        dist_df["lag2"]  = dist_df["total"].shift(2)
        dist_df["lag3"]  = dist_df["total"].shift(3)
        dist_df["lag6"]  = dist_df["total"].shift(6)
        dist_df["roll3"] = dist_df["total"].rolling(3).mean()
        dist_df["roll6"] = dist_df["total"].rolling(6).mean()
        dist_df["month_of_year"] = ((dist_df["period"] - 1) % 12) + 1
        training_df = dist_df.dropna()

        FEATURES = ["period", "lag1", "lag2", "lag3", "lag6", "roll3", "roll6", "month_of_year"]
        if len(training_df) >= 3:
            X = training_df[FEATURES].values
            y = training_df["total"].values
            model = GradientBoostingRegressor(n_estimators=120, learning_rate=0.08, max_depth=4, subsample=0.85, random_state=42)
            if len(X) >= 8:
                split = int(len(X) * 0.8)
                model.fit(X[:split], y[:split])
                y_pred_cv = model.predict(X[split:])
                mae = mean_absolute_error(y[split:], y_pred_cv)
            else:
                mae = 0.0
            model.fit(X, y)
            conf = confidence_from_mae(mae, mean_val)
            p75 = float(np.percentile(y, 75))
            p90 = float(np.percentile(y, 90))
        else:
            return _forecast_fallback(district, dist_df)

    # Iterative forecast next 6 months
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
        predicted = max(0.0, predicted)

        month_num    = ((next_period - 1) % 12) + 1
        period_label = f"2025-{month_num:02d}"
        std_err = mae * 1.5 if mae > 0 else max(1.0, mean_val * 0.2)

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
        "model": "GradientBoostingRegressor" if cached else "GradientBoostingRegressor (Dynamic)",
        "mae": round(mae, 2),
        "confidence": conf,
        "historical_mean": round(mean_val, 1),
        "forecast": forecasts,
    }

def _forecast_fallback(district: str, dist_df: pd.DataFrame) -> dict:
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

# ─── 2. Top-district ranking forecast (Ridge Regression) ──────────────────────

def ml_top_district_forecasts(db: Session, top_n: int = 10) -> list:
    df = load_monthly_series(db)
    if df.empty:
        return []

    agg = df.groupby(["period", "district"])["total"].sum().reset_index()
    districts = agg["district"].unique()
    results   = []

    for dist in districts:
        sub = agg[agg["district"] == dist].sort_values("period")
        if len(sub) < 4:
            continue

        cached = load_model(f"ridge_{dist}")
        next_period = int(sub["period"].iloc[-1]) + 1

        if cached:
            ridge, conf, mean_val, trend_label, trend_slope, p75, p90 = cached
            predicted = max(0, float(ridge.predict([[next_period]])[0]))
        else:
            # Dynamic fallback
            X = sub["period"].values.reshape(-1, 1)
            y = sub["total"].values
            ridge = Ridge(alpha=1.0)
            ridge.fit(X, y)
            predicted = max(0, float(ridge.predict([[next_period]])[0]))
            trend_slope = float(ridge.coef_[0])
            trend_label = "Rising" if trend_slope > 0.5 else ("Falling" if trend_slope < -0.5 else "Stable")
            last_12 = y[-12:]
            mean_val = float(np.mean(last_12))
            p75 = float(np.percentile(y, 75))
            p90 = float(np.percentile(y, 90))
            ss_res = np.sum((y - ridge.predict(X)) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r2 = max(0.0, 1 - ss_res / (ss_tot + 1e-9))
            conf = min(0.97, round(0.55 + r2 * 0.40, 3))

        results.append({
            "district":        dist,
            "predicted_next_month": int(round(predicted)),
            "trend":           trend_label,
            "trend_slope":     round(trend_slope, 3) if not cached else trend_slope,
            "confidence":      conf,
            "severity":        severity_from_count(predicted, p75, p90),
            "historical_mean": round(mean_val, 1),
            "model":           "Ridge" if cached else "Ridge (Dynamic)",
        })

    results.sort(key=lambda x: x["predicted_next_month"], reverse=True)
    return results[:top_n]

# ─── 3. Anomaly spike detector (Isolation Forest) ────────────────────────────

def detect_crime_spikes(db: Session) -> list:
    df = load_monthly_series(db)
    if df.empty:
        return []

    agg = df.groupby(["year", "month", "district"])["total"].sum().reset_index()
    if len(agg) < 10:
        return []

    cached = load_model("isolation_forest")
    if cached:
        iso, le = cached
        # Avoid crash if new districts not seen in training are added
        encoded_districts = []
        known_classes = set(le.classes_)
        for d in agg["district"]:
            if d in known_classes:
                encoded_districts.append(le.transform([d])[0])
            else:
                encoded_districts.append(0) # fallback category
        agg["district_enc"] = encoded_districts
    else:
        # Dynamic fallback
        le = LabelEncoder()
        agg["district_enc"] = le.fit_transform(agg["district"])
        features = agg[["year", "month", "district_enc", "total"]].values
        iso = IsolationForest(contamination=0.05, random_state=42, n_estimators=100)
        iso.fit(features)

    features = agg[["year", "month", "district_enc", "total"]].values
    agg["anomaly_score"] = iso.predict(features)
    agg["raw_score"]     = iso.score_samples(features)

    # anomaly_score == -1 indicates outlier
    spikes = agg[agg["anomaly_score"] == -1].sort_values("raw_score").head(15)
    return [{
        "district":    row["district"],
        "year":        int(row["year"]),
        "month":       int(row["month"]),
        "crime_count": int(row["total"]),
        "anomaly_score": round(float(row["raw_score"]), 4),
        "period":      f"{int(row['year'])}-{int(row['month']):02d}",
    } for _, row in spikes.iterrows()]

# ─── 4. Crime-type breakdown ML forecast ─────────────────────────────────────

def ml_crime_type_forecast(db: Session, district: str) -> list:
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
        if len(sub) < 3:
            continue

        X = sub["period"].values.reshape(-1, 1)
        y = sub["total"].values.astype(float)
        model = LinearRegression()
        model.fit(X, y)

        next_period = int(sub["period"].iloc[-1]) + 1
        predicted   = max(0.0, float(model.predict([[next_period]])[0]))
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

# ─── 5. Model self-training pipeline task ───────────────────────────────────

def train_and_save_all_models(db: Session) -> bool:
    """
    Auto-Training Pipeline: retrieves the entire crimes series,
    trains all GradientBoosting, Ridge, and IsolationForest models,
    and serializes them as pkl files.
    """
    df = load_monthly_series(db)
    if df.empty:
        print("⚠️ Self-Training: No historical series found. Skipping.")
        return False

    print("🚀 Self-Training: Retraining all ML models on latest database state...")

    # 1. Gradient Boosting per district
    districts = df["district"].unique()
    for dist in districts:
        dist_df = df[df["district"] == dist].groupby("period")["total"].sum().reset_index()
        if len(dist_df) < 12:
            continue

        dist_df = dist_df.sort_values("period").reset_index(drop=True)
        dist_df["lag1"]  = dist_df["total"].shift(1)
        dist_df["lag2"]  = dist_df["total"].shift(2)
        dist_df["lag3"]  = dist_df["total"].shift(3)
        dist_df["lag6"]  = dist_df["total"].shift(6)
        dist_df["roll3"] = dist_df["total"].rolling(3).mean()
        dist_df["roll6"] = dist_df["total"].rolling(6).mean()
        dist_df["month_of_year"] = ((dist_df["period"] - 1) % 12) + 1
        training_df = dist_df.dropna()

        FEATURES = ["period", "lag1", "lag2", "lag3", "lag6", "roll3", "roll6", "month_of_year"]
        if len(training_df) >= 3:
            X = training_df[FEATURES].values
            y = training_df["total"].values
            model = GradientBoostingRegressor(n_estimators=120, learning_rate=0.08, max_depth=4, subsample=0.85, random_state=42)
            if len(X) >= 8:
                split = int(len(X) * 0.8)
                model.fit(X[:split], y[:split])
                y_pred_cv = model.predict(X[split:])
                mae = mean_absolute_error(y[split:], y_pred_cv)
            else:
                mae = 0.0
            model.fit(X, y)
            mean_val = float(np.mean(y[-12:]))
            conf = confidence_from_mae(mae, mean_val)
            p75 = float(np.percentile(y, 75))
            p90 = float(np.percentile(y, 90))

            save_model(f"gb_{dist}", (model, conf, mean_val, mae, p75, p90, FEATURES))

    # 2. Ridge Regression per district
    agg = df.groupby(["period", "district"])["total"].sum().reset_index()
    for dist in districts:
        sub = agg[agg["district"] == dist].sort_values("period")
        if len(sub) < 4:
            continue
        X = sub["period"].values.reshape(-1, 1)
        y = sub["total"].values
        ridge = Ridge(alpha=1.0)
        ridge.fit(X, y)

        next_period = int(sub["period"].iloc[-1]) + 1
        predicted = max(0.0, float(ridge.predict([[next_period]])[0]))
        trend_slope = float(ridge.coef_[0])
        trend_label = "Rising" if trend_slope > 0.5 else ("Falling" if trend_slope < -0.5 else "Stable")

        last_12 = y[-12:]
        mean_val = float(np.mean(last_12))
        p75 = float(np.percentile(y, 75))
        p90 = float(np.percentile(y, 90))

        ss_res = np.sum((y - ridge.predict(X)) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r2 = max(0.0, 1 - ss_res / (ss_tot + 1e-9))
        conf = min(0.97, round(0.55 + r2 * 0.40, 3))

        save_model(f"ridge_{dist}", (ridge, conf, mean_val, trend_label, trend_slope, p75, p90))

    # 3. Isolation Forest
    agg_anomaly = df.groupby(["year", "month", "district"])["total"].sum().reset_index()
    if len(agg_anomaly) >= 10:
        le = LabelEncoder()
        agg_anomaly["district_enc"] = le.fit_transform(agg_anomaly["district"])
        features_anom = agg_anomaly[["year", "month", "district_enc", "total"]].values
        iso = IsolationForest(contamination=0.05, random_state=42, n_estimators=100)
        iso.fit(features_anom)
        save_model("isolation_forest", (iso, le))

    print("✅ Self-Training: All predictive models successfully retrained and saved to disk.")
    return True
