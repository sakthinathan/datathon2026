from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from routers.auth import get_current_user

router = APIRouter(prefix="/sociology", tags=["sociology"])


@router.get("/demographic-breakdown")
async def demographic_breakdown(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Age group, gender, and occupation breakdown of suspects"""
    age_result = db.execute(text("""
        SELECT
            CASE
                WHEN age BETWEEN 15 AND 25 THEN '15-25'
                WHEN age BETWEEN 26 AND 35 THEN '26-35'
                WHEN age BETWEEN 36 AND 50 THEN '36-50'
                ELSE '50+'
            END as age_group,
            COUNT(*) as count
        FROM suspects
        WHERE age IS NOT NULL
        GROUP BY age_group ORDER BY age_group
    """))
    gender_result = db.execute(text(
        "SELECT gender, COUNT(*) as count FROM suspects GROUP BY gender ORDER BY count DESC"
    ))
    occ_result = db.execute(text(
        "SELECT occupation, COUNT(*) as count FROM suspects GROUP BY occupation ORDER BY count DESC LIMIT 12"
    ))
    return {
        "age_groups": [{"age_group": r[0], "count": r[1]} for r in age_result.fetchall()],
        "gender": [{"gender": r[0], "count": r[1]} for r in gender_result.fetchall()],
        "occupations": [{"occupation": r[0], "count": r[1]} for r in occ_result.fetchall()],
    }


@router.get("/crime-by-gender")
async def crime_by_gender(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Crime type breakdown split by suspect gender"""
    result = db.execute(text("""
        SELECT s.gender, c.crime_type, COUNT(*) as count
        FROM suspects s
        JOIN crimes c ON (',' || s.crime_history || ',') LIKE ('%,' || CAST(c.id AS TEXT) || ',%')
        WHERE s.gender IS NOT NULL
        GROUP BY s.gender, c.crime_type
        ORDER BY count DESC
        LIMIT 40
    """))
    rows = result.fetchall()
    # Pivot to {crime_type: {Male: n, Female: n}}
    pivot: dict = {}
    for gender, crime_type, count in rows:
        if crime_type not in pivot:
            pivot[crime_type] = {"crime_type": crime_type, "Male": 0, "Female": 0, "Other": 0}
        pivot[crime_type][gender if gender in ["Male", "Female"] else "Other"] += count
    return sorted(list(pivot.values()), key=lambda x: x["Male"] + x["Female"], reverse=True)[:12]


@router.get("/crime-by-age-group")
async def crime_by_age_group(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Number of suspects per crime type, grouped by age band"""
    result = db.execute(text("""
        SELECT
            CASE
                WHEN age BETWEEN 15 AND 25 THEN '15-25'
                WHEN age BETWEEN 26 AND 35 THEN '26-35'
                WHEN age BETWEEN 36 AND 50 THEN '36-50'
                ELSE '50+'
            END as age_group,
            risk_level,
            COUNT(*) as count
        FROM suspects
        WHERE age IS NOT NULL
        GROUP BY age_group, risk_level
        ORDER BY age_group
    """))
    rows = result.fetchall()
    pivot: dict = {}
    for age_group, risk_level, count in rows:
        if age_group not in pivot:
            pivot[age_group] = {"age_group": age_group, "High": 0, "Medium": 0, "Low": 0}
        pivot[age_group][risk_level] = count
    return list(pivot.values())


@router.get("/economic-risk-zones")
async def economic_risk_zones(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Districts with high concentrations of economically vulnerable suspects"""
    result = db.execute(text("""
        SELECT district,
            SUM(CASE WHEN occupation IN ('Unemployed', 'Laborer', 'Daily Wage Worker') THEN 1 ELSE 0 END) as vulnerable,
            COUNT(*) as total,
            ROUND(100.0 * SUM(CASE WHEN occupation IN ('Unemployed', 'Laborer', 'Daily Wage Worker') THEN 1 ELSE 0 END) / COUNT(*), 1) as vulnerability_pct
        FROM suspects
        GROUP BY district
        ORDER BY vulnerable DESC
        LIMIT 15
    """))
    return [{"district": r[0], "vulnerable": r[1], "total": r[2], "vulnerability_pct": r[3]}
            for r in result.fetchall()]


@router.get("/repeat-vs-first-time")
async def repeat_vs_first_time(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Compare repeat offenders vs first-time offenders per district"""
    result = db.execute(text("""
        SELECT district,
            SUM(CASE WHEN (LENGTH(crime_history) - LENGTH(REPLACE(crime_history, ',', ''))) >= 1 THEN 1 ELSE 0 END) as repeat_offenders,
            SUM(CASE WHEN crime_history IS NULL OR crime_history = '' OR crime_history NOT LIKE '%,%' THEN 1 ELSE 0 END) as first_time
        FROM suspects
        GROUP BY district
        ORDER BY repeat_offenders DESC
        LIMIT 15
    """))
    return [{"district": r[0], "repeat_offenders": r[1], "first_time": r[2]}
            for r in result.fetchall()]


@router.get("/social-risk-summary")
async def social_risk_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Overall social risk indicators across Karnataka"""
    total = db.execute(text("SELECT COUNT(*) FROM suspects")).scalar() or 1
    unemployed = db.execute(text("SELECT COUNT(*) FROM suspects WHERE occupation='Unemployed'")).scalar()
    high_risk_youth = db.execute(text("SELECT COUNT(*) FROM suspects WHERE age <= 25 AND risk_level='High'")).scalar()
    habitual = db.execute(text("""
        SELECT COUNT(*) FROM suspects
        WHERE (LENGTH(crime_history) - LENGTH(REPLACE(crime_history, ',', ''))) >= 5
    """)).scalar()
    gang = db.execute(text("""
        SELECT COUNT(*) FROM suspects
        WHERE (LENGTH(connections) - LENGTH(REPLACE(connections, ',', ''))) >= 4
        AND risk_level = 'High'
    """)).scalar()
    return {
        "total_suspects": total,
        "unemployed_count": unemployed,
        "unemployed_pct": round(unemployed / total * 100, 1),
        "high_risk_youth": high_risk_youth,
        "high_risk_youth_pct": round(high_risk_youth / total * 100, 1),
        "habitual_offenders": habitual,
        "gang_associates": gang,
    }
