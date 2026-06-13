from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, Prediction, Crime
from routers.auth import get_current_user
from services.ml_service import (
    ml_forecast_district,
    ml_top_district_forecasts,
    detect_crime_spikes,
    ml_crime_type_forecast,
)
from typing import Optional

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.get("/alerts")
async def get_alerts(severity: Optional[str] = None, district: Optional[str] = None,
                     db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = db.query(Prediction)
    if severity and severity != "All":
        q = q.filter(Prediction.severity == severity)
    if district and district != "All":
        q = q.filter(Prediction.district == district)
    preds = q.order_by(Prediction.predicted_count.desc()).all()
    return [{
        "id": p.id, "district": p.district, "crime_type": p.crime_type,
        "predicted_month": p.predicted_month, "predicted_count": p.predicted_count,
        "confidence": p.confidence, "severity": p.severity, "trend": p.trend,
        "created_at": p.created_at.isoformat()
    } for p in preds]


@router.get("/hotspots")
async def get_hotspots(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """ML-powered: top districts by predicted next-month crime volume."""
    ml_results = ml_top_district_forecasts(db, top_n=10)
    if ml_results:
        return [{
            "district":        r["district"],
            "crime_type":      "All Types",
            "predicted_count": r["predicted_next_month"],
            "confidence":      r["confidence"],
            "severity":        r["severity"],
            "trend":           r["trend"],
            "model":           r["model"],
            "ml_powered":      True,
        } for r in ml_results]
    # Fallback to DB predictions if ML fails
    critical = db.query(Prediction).filter(Prediction.severity == "Critical") \
                  .order_by(Prediction.predicted_count.desc()).limit(10).all()
    return [{"district": p.district, "crime_type": p.crime_type,
             "predicted_count": p.predicted_count, "confidence": p.confidence,
             "severity": p.severity, "trend": p.trend, "ml_powered": False}
            for p in critical]


@router.get("/forecast/{district}")
async def district_forecast(district: str, db: Session = Depends(get_db),
                             current_user=Depends(get_current_user)):
    """Real ML GradientBoosting forecast for a specific district."""
    ml_result = ml_forecast_district(db, district)

    # Also return historical data from DB
    result = db.execute(text(
        "SELECT year, month, COUNT(*) as total FROM crimes "
        "WHERE district=:d GROUP BY year, month ORDER BY year, month"
    ), {"d": district})
    rows = result.fetchall()
    historical = [{"period": f"{r[0]}-{r[1]:02d}", "total": r[2]} for r in rows]

    # Crime type breakdown forecast
    type_forecast = ml_crime_type_forecast(db, district)

    return {
        "district":        district,
        "historical":      historical[-24:],
        "forecast":        ml_result.get("forecast", []),
        "model":           ml_result.get("model", "unknown"),
        "mae":             ml_result.get("mae"),
        "confidence":      ml_result.get("confidence"),
        "historical_mean": ml_result.get("historical_mean"),
        "crime_type_forecast": type_forecast[:10],
    }


@router.get("/summary")
async def prediction_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    total    = db.query(Prediction).count()
    critical = db.query(Prediction).filter(Prediction.severity == "Critical").count()
    warning  = db.query(Prediction).filter(Prediction.severity == "Warning").count()
    rising   = db.query(Prediction).filter(Prediction.trend == "Rising").count()
    return {
        "total_alerts":  total,
        "critical":      critical,
        "warning":       warning,
        "normal":        total - critical - warning,
        "rising_trend":  rising,
    }


@router.get("/early-warnings")
async def early_warnings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """ML anomaly detection + DB high-confidence alerts combined."""
    # Anomaly-detected spikes
    spikes = detect_crime_spikes(db)

    # High-confidence DB predictions
    preds = db.query(Prediction).filter(
        Prediction.trend == "Rising",
        Prediction.severity.in_(["Critical", "Warning"]),
        Prediction.confidence >= 0.80
    ).order_by(Prediction.predicted_count.desc()).limit(12).all()

    action_map = {
        "Murder":         "Deploy armed patrol units; liaise with local informants",
        "Drug Offense":   "Initiate NDPS surveillance operations in the district",
        "Robbery":        "Increase night patrols; coordinate with bank security",
        "Kidnapping":     "Alert child welfare teams; set up checkpoints at district borders",
        "Cybercrime":     "Brief cyber cell; issue public advisory on phishing",
        "Chain Snatching":"Deploy plainclothes officers in market areas",
        "Theft":          "Increase beat constable presence in high-density zones",
        "Assault":        "Coordinate with local panchayats for dispute resolution",
    }

    warnings_out = [{
        "id":                p.id,
        "district":          p.district,
        "crime_type":        p.crime_type,
        "predicted_count":   p.predicted_count,
        "confidence":        p.confidence,
        "severity":          p.severity,
        "trend":             p.trend,
        "recommended_action": action_map.get(p.crime_type, "Increase general law enforcement presence"),
        "urgency":           "IMMEDIATE" if p.severity == "Critical" and p.confidence > 0.88 else "HIGH",
        "source":            "prediction_model",
    } for p in preds]

    # Prepend ML-detected anomalies as ANOMALY alerts
    for spike in spikes[:5]:
        warnings_out.insert(0, {
            "id":              f"anomaly-{spike['district']}-{spike['period']}",
            "district":        spike["district"],
            "crime_type":      "Multiple (Spike Detected)",
            "predicted_count": spike["crime_count"],
            "confidence":      round(abs(spike["anomaly_score"]) * 2, 2),
            "severity":        "Critical",
            "trend":           "Rising",
            "recommended_action": "Anomalous crime spike detected by ML model — initiate emergency coordination",
            "urgency":         "IMMEDIATE",
            "source":          "IsolationForest_ML",
            "period":          spike["period"],
        })

    return warnings_out


@router.get("/ml/district-rankings")
async def ml_district_rankings(db: Session = Depends(get_db),
                                current_user=Depends(get_current_user)):
    """ML-ranked district list by predicted next-month crime volume."""
    return ml_top_district_forecasts(db, top_n=31)


@router.get("/ml/anomalies")
async def ml_anomalies(db: Session = Depends(get_db),
                       current_user=Depends(get_current_user)):
    """IsolationForest crime spike anomaly detection results."""
    return detect_crime_spikes(db)
