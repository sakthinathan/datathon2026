from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, Suspect
from routers.auth import get_current_user
from typing import Optional

router = APIRouter(prefix="/offenders", tags=["offenders"])

@router.get("/repeat-offenders")
async def repeat_offenders(district: Optional[str] = None, risk_level: Optional[str] = None,
                            db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = db.query(Suspect)
    if district and district != "All":
        q = q.filter(Suspect.district == district)
    if risk_level and risk_level != "All":
        q = q.filter(Suspect.risk_level == risk_level)
    suspects = q.order_by(Suspect.risk_level.desc()).limit(50).all()
    result = []
    for s in suspects:
        crime_ids = s.crime_history.split(",") if s.crime_history else []
        conn_ids = s.connections.split(",") if s.connections else []
        result.append({
            "id": s.id, "name": s.name, "alias": s.alias,
            "age": s.age, "gender": s.gender, "district": s.district,
            "occupation": s.occupation, "risk_level": s.risk_level,
            "crime_count": len(crime_ids),
            "network_size": len(conn_ids),
            "risk_score": {"High": 90, "Medium": 55, "Low": 20}.get(s.risk_level, 0),
            "behavioral_tags": _get_behavioral_tags(s.risk_level, len(crime_ids), s.occupation),
        })
    return sorted(result, key=lambda x: x["risk_score"], reverse=True)

@router.get("/risk-distribution")
async def risk_distribution(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    result = db.execute(text("SELECT risk_level, COUNT(*) as count FROM suspects GROUP BY risk_level"))
    return [{"risk_level": r[0], "count": r[1]} for r in result.fetchall()]

@router.get("/district-profile")
async def district_profile(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    result = db.execute(text(
        "SELECT district, risk_level, COUNT(*) as count FROM suspects "
        "GROUP BY district, risk_level ORDER BY count DESC LIMIT 40"
    ))
    rows = result.fetchall()
    districts: dict = {}
    for r in rows:
        if r[0] not in districts:
            districts[r[0]] = {"district": r[0], "High": 0, "Medium": 0, "Low": 0, "total": 0}
        districts[r[0]][r[1]] = r[2]
        districts[r[0]]["total"] += r[2]
    return sorted(list(districts.values()), key=lambda x: x["total"], reverse=True)[:15]

def _get_behavioral_tags(risk_level, crime_count, occupation):
    tags = []
    if crime_count > 6: tags.append("Habitual Offender")
    elif crime_count > 3: tags.append("Repeat Offender")
    if risk_level == "High": tags.append("High Surveillance")
    if occupation in ["Unemployed", "Laborer"]: tags.append("Economically Vulnerable")
    if risk_level == "High" and crime_count > 4: tags.append("Gang Associate")
    return tags
