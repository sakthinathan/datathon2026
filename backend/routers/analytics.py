from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from database import get_db, Crime, PoliceStation
from routers.auth import get_current_user
from typing import Optional

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/overview")
async def get_overview(district: Optional[str] = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role == "district_sp":
        district = current_user.district

    q_crimes = db.query(func.count(Crime.id))
    q_stations = db.query(func.count(PoliceStation.id))
    q_critical = db.query(func.count(Crime.id)).filter(Crime.severity == "Critical")
    q_solved = db.query(func.count(Crime.id)).filter(Crime.status == "Closed")
    q_recent = db.query(func.count(Crime.id)).filter(Crime.year == 2024)
    q_pending = db.query(func.count(Crime.id)).filter(Crime.status == "Under Investigation")

    if district and district != "All":
        q_crimes = q_crimes.filter(Crime.district == district)
        q_stations = q_stations.filter(PoliceStation.district == district)
        q_critical = q_critical.filter(Crime.district == district)
        q_solved = q_solved.filter(Crime.district == district)
        q_recent = q_recent.filter(Crime.district == district)
        q_pending = q_pending.filter(Crime.district == district)

    total_crimes = q_crimes.scalar() or 0
    total_stations = q_stations.scalar() or 0
    critical = q_critical.scalar() or 0
    solved = q_solved.scalar() or 0
    recent = q_recent.scalar() or 0
    pending = q_pending.scalar() or 0

    return {
        "total_crimes": total_crimes,
        "total_stations": total_stations,
        "critical_cases": critical,
        "solved_cases": solved,
        "solve_rate": round((solved / total_crimes * 100), 1) if total_crimes else 0,
        "recent_year_crimes": recent,
        "pending_investigation": pending,
        "districts_covered": 1 if (district and district != "All") else 31,
    }

@router.get("/trends/yearly")
async def yearly_trends(district: Optional[str] = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role == "district_sp":
        district = current_user.district

    if district and district != "All":
        result = db.execute(text(
            "SELECT year, COUNT(*) as total, SUM(CASE WHEN status='Closed' THEN 1 ELSE 0 END) as solved "
            "FROM crimes WHERE district=:d GROUP BY year ORDER BY year"
        ), {"d": district})
    else:
        result = db.execute(text(
            "SELECT year, COUNT(*) as total, SUM(CASE WHEN status='Closed' THEN 1 ELSE 0 END) as solved "
            "FROM crimes GROUP BY year ORDER BY year"
        ))
    rows = result.fetchall()
    return [{"year": r[0], "total": r[1], "solved": r[2], "solve_rate": round(r[2]/r[1]*100,1) if r[1] else 0} for r in rows]

@router.get("/trends/monthly")
async def monthly_trends(year: Optional[int] = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if year:
        result = db.execute(text("SELECT month, COUNT(*) as total FROM crimes WHERE year=:y GROUP BY month ORDER BY month"), {"y": year})
    else:
        result = db.execute(text("SELECT month, COUNT(*) as total FROM crimes GROUP BY month ORDER BY month"))
    rows = result.fetchall()
    month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    return [{"month": month_names[r[0]-1], "month_num": r[0], "total": r[1]} for r in rows]

@router.get("/by-district")
async def by_district(year: Optional[int] = None, crime_type: Optional[str] = None,
                      db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = "SELECT district, COUNT(*) as total, SUM(CASE WHEN severity='Critical' THEN 1 ELSE 0 END) as critical_count FROM crimes WHERE 1=1"
    params = {}
    if year:
        q += " AND year=:year"; params["year"] = year
    if crime_type and crime_type != "All":
        q += " AND crime_type=:ct"; params["ct"] = crime_type
    q += " GROUP BY district ORDER BY total DESC"
    result = db.execute(text(q), params)
    rows = result.fetchall()
    return [{"district": r[0], "total": r[1], "critical": r[2]} for r in rows]

@router.get("/by-crime-type")
async def by_crime_type(year: Optional[int] = None, district: Optional[str] = None,
                         db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = "SELECT crime_type, COUNT(*) as total, ipc_section FROM crimes WHERE 1=1"
    params = {}
    if year:
        q += " AND year=:year"; params["year"] = year
    if district and district != "All":
        q += " AND district=:district"; params["district"] = district
    q += " GROUP BY crime_type ORDER BY total DESC"
    result = db.execute(text(q), params)
    rows = result.fetchall()
    return [{"crime_type": r[0], "total": r[1], "ipc_section": r[2]} for r in rows]

@router.get("/severity-distribution")
async def severity_distribution(district: Optional[str] = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role == "district_sp":
        district = current_user.district

    if district and district != "All":
        result = db.execute(text("SELECT severity, COUNT(*) as total FROM crimes WHERE district=:d GROUP BY severity ORDER BY total DESC"), {"d": district})
    else:
        result = db.execute(text("SELECT severity, COUNT(*) as total FROM crimes GROUP BY severity ORDER BY total DESC"))
    rows = result.fetchall()
    return [{"severity": r[0], "total": r[1]} for r in rows]

@router.get("/heatmap-data")
async def heatmap_data(year: Optional[int] = None, crime_type: Optional[str] = None,
                        db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = "SELECT district, latitude, longitude, COUNT(*) as crime_count, crime_type FROM crimes WHERE 1=1"
    params = {}
    if year:
        q += " AND year=:year"; params["year"] = year
    if crime_type and crime_type != "All":
        q += " AND crime_type=:ct"; params["ct"] = crime_type
    q += " GROUP BY district LIMIT 200"
    result = db.execute(text(q), params)
    rows = result.fetchall()
    return [{"district": r[0], "lat": r[1], "lon": r[2], "count": r[3], "crime_type": r[4]} for r in rows]

@router.get("/police-stations")
async def police_stations_stats(district: Optional[str] = None,
                                 db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = db.query(PoliceStation)
    if district and district != "All":
        q = q.filter(PoliceStation.district == district)
    stations = q.order_by(PoliceStation.cases_filed.desc()).limit(50).all()
    return [{
        "id": s.id, "name": s.name, "district": s.district, "taluk": s.taluk,
        "officer_count": s.officer_count, "cases_filed": s.cases_filed,
        "cases_solved": s.cases_solved,
        "solve_rate": round(s.cases_solved / s.cases_filed * 100, 1) if s.cases_filed else 0,
        "lat": s.latitude, "lon": s.longitude
    } for s in stations]

@router.get("/time-of-day")
async def time_of_day(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    result = db.execute(text("""
        SELECT CAST(substr(time, 1, 2) AS INTEGER) as hour, COUNT(*) as total 
        FROM crimes WHERE time IS NOT NULL 
        GROUP BY hour ORDER BY hour
    """))
    rows = result.fetchall()
    return [{"hour": r[0], "total": r[1]} for r in rows]

@router.get("/district-comparison")
async def district_comparison(d1: str, d2: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    def get_district_stats(district):
        result = db.execute(text(
            "SELECT year, COUNT(*) as total FROM crimes WHERE district=:d GROUP BY year ORDER BY year"
        ), {"d": district})
        return result.fetchall()
    d1_data = get_district_stats(d1)
    d2_data = get_district_stats(d2)
    return {
        "district1": {"name": d1, "data": [{"year": r[0], "total": r[1]} for r in d1_data]},
        "district2": {"name": d2, "data": [{"year": r[0], "total": r[1]} for r in d2_data]},
    }
