from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, Crime, Suspect
from routers.auth import get_current_user
from typing import Optional
import os, httpx, re, json

router = APIRouter(prefix="/investigator", tags=["investigator"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


@router.get("/case-summary/{crime_id}")
async def case_summary(crime_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """AI-generated structured case summary for a specific FIR"""
    crime = db.query(Crime).filter(Crime.id == crime_id).first()
    if not crime:
        raise HTTPException(status_code=404, detail="Case not found")

    case_data = {
        "fir_number": crime.fir_number,
        "date": crime.date,
        "district": crime.district,
        "police_station": crime.police_station,
        "crime_type": crime.crime_type,
        "ipc_section": crime.ipc_section,
        "severity": crime.severity,
        "status": crime.status,
        "victim_count": crime.victim_count,
        "accused_count": crime.accused_count,
        "description": crime.description,
        "property_value": crime.property_value,
    }

    if GEMINI_API_KEY:
        try:
            prompt = f"""You are a police case analyst. Generate a structured case summary for this FIR:
{json.dumps(case_data, indent=2)}

Provide a JSON response with:
{{
  "summary": "2-3 sentence case overview",
  "key_facts": ["fact1", "fact2", "fact3"],
  "investigation_status": "current status analysis",
  "recommended_actions": ["action1", "action2"],
  "similar_ipc_patterns": "brief description of typical cases under this IPC section"
}}
Return only valid JSON, no markdown."""
            url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(url, json=payload, headers={"X-goog-api-key": GEMINI_API_KEY})
            if resp.status_code == 200:
                raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                raw = re.sub(r'^```json\s*', '', raw)
                raw = re.sub(r'\s*```$', '', raw)
                ai_summary = json.loads(raw)
                return {**case_data, **ai_summary, "ai_generated": True}
        except Exception as e:
            print(f"AI summary error: {e}")

    # Fallback
    return {
        **case_data,
        "summary": f"FIR {crime.fir_number} filed at {crime.police_station} police station on {crime.date}. Crime type: {crime.crime_type} under IPC {crime.ipc_section}. Status: {crime.status}.",
        "key_facts": [
            f"Victims involved: {crime.victim_count}",
            f"Accused count: {crime.accused_count}",
            f"Severity: {crime.severity}",
        ],
        "investigation_status": f"Case is currently {crime.status}.",
        "recommended_actions": ["Review CCTV footage from the area", "Cross-reference suspect records in the district"],
        "similar_ipc_patterns": f"Cases under IPC {crime.ipc_section} typically involve {crime.crime_type.lower()} offences.",
        "ai_generated": False,
    }


@router.get("/similar-cases")
async def similar_cases(
    crime_type: Optional[str] = None,
    district: Optional[str] = None,
    ipc_section: Optional[str] = None,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Find similar past cases by crime type, district, or IPC section"""
    q = "SELECT id, fir_number, date, district, crime_type, ipc_section, severity, status, description FROM crimes WHERE 1=1"
    params: dict = {}
    if crime_type:
        q += " AND crime_type=:ct"; params["ct"] = crime_type
    if district:
        q += " AND district=:d"; params["d"] = district
    if ipc_section:
        q += " AND ipc_section=:ipc"; params["ipc"] = ipc_section
    q += " ORDER BY date DESC LIMIT :lim"; params["lim"] = limit
    result = db.execute(text(q), params)
    rows = result.fetchall()
    return [{
        "id": r[0], "fir_number": r[1], "date": r[2], "district": r[3],
        "crime_type": r[4], "ipc_section": r[5], "severity": r[6],
        "status": r[7], "description": (r[8] or "")[:120] + "..."
    } for r in rows]


@router.post("/generate-leads")
async def generate_leads(
    suspect_id: Optional[int] = None,
    crime_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """AI-powered investigative leads for a suspect or case"""
    context = {}
    if suspect_id:
        suspect = db.query(Suspect).filter(Suspect.id == suspect_id).first()
        if suspect:
            crime_ids = suspect.crime_history.split(",") if suspect.crime_history else []
            conn_ids = suspect.connections.split(",") if suspect.connections else []
            context["suspect"] = {
                "name": suspect.name, "alias": suspect.alias,
                "district": suspect.district, "age": suspect.age,
                "risk_level": suspect.risk_level, "occupation": suspect.occupation,
                "crime_count": len(crime_ids), "connections": len(conn_ids)
            }
    if crime_id:
        crime = db.query(Crime).filter(Crime.id == crime_id).first()
        if crime:
            context["crime"] = {
                "fir": crime.fir_number, "type": crime.crime_type,
                "district": crime.district, "status": crime.status,
                "ipc": crime.ipc_section
            }

    if not context:
        raise HTTPException(status_code=400, detail="Provide suspect_id or crime_id")

    if GEMINI_API_KEY:
        try:
            prompt = f"""You are an expert police investigator in Karnataka, India. Based on the following context, generate investigative leads:
{json.dumps(context, indent=2)}

Return JSON:
{{
  "immediate_actions": ["action1", "action2", "action3"],
  "persons_of_interest": ["description of who else to check"],
  "evidence_to_collect": ["evidence type 1", "evidence type 2"],
  "cross_references": ["other FIR types to check", "databases to query"],
  "risk_assessment": "brief risk assessment"
}}
Only valid JSON."""
            url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(url, json=payload, headers={"X-goog-api-key": GEMINI_API_KEY})
            if resp.status_code == 200:
                raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                raw = re.sub(r'^```json\s*', '', raw)
                raw = re.sub(r'\s*```$', '', raw)
                return {**json.loads(raw), "context": context, "ai_generated": True}
        except Exception as e:
            print(f"Lead generation error: {e}")

    # Fallback leads
    leads = {
        "immediate_actions": [
            "Cross-reference suspect in CCTNS database",
            "Check travel records at district border checkpoints",
            "Interview associates in the same district"
        ],
        "persons_of_interest": ["Known associates listed in suspect connections"],
        "evidence_to_collect": ["CCTV footage from the crime scene vicinity", "Call records within 24 hrs of incident"],
        "cross_references": ["Check similar MO cases in the district", "NDPS records for drug-related linkages"],
        "risk_assessment": "Standard investigation protocol recommended",
        "context": context,
        "ai_generated": False,
    }
    return leads


@router.get("/case-timeline/{district}")
async def case_timeline(
    district: str,
    year: Optional[int] = None,
    crime_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Chronological crime timeline for a district"""
    q = "SELECT id, fir_number, date, time, crime_type, ipc_section, severity, status, police_station FROM crimes WHERE district=:d"
    params: dict = {"d": district}
    if year:
        q += " AND year=:y"; params["y"] = year
    if crime_type and crime_type != "All":
        q += " AND crime_type=:ct"; params["ct"] = crime_type
    q += " ORDER BY date DESC, time DESC LIMIT :lim"; params["lim"] = limit
    result = db.execute(text(q), params)
    rows = result.fetchall()
    return [{
        "id": r[0], "fir_number": r[1], "date": r[2], "time": r[3],
        "crime_type": r[4], "ipc_section": r[5], "severity": r[6],
        "status": r[7], "police_station": r[8]
    } for r in rows]


@router.get("/search-cases")
async def search_cases(
    q: str,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Full-text search across FIR numbers, crime types, districts, and descriptions"""
    result = db.execute(text("""
        SELECT id, fir_number, date, district, crime_type, severity, status, description
        FROM crimes
        WHERE fir_number LIKE :q
           OR district LIKE :q
           OR crime_type LIKE :q
           OR police_station LIKE :q
           OR description LIKE :q
        ORDER BY date DESC LIMIT :lim
    """), {"q": f"%{q}%", "lim": limit})
    rows = result.fetchall()
    return [{
        "id": r[0], "fir_number": r[1], "date": r[2], "district": r[3],
        "crime_type": r[4], "severity": r[5], "status": r[6],
        "description": (r[7] or "")[:100]
    } for r in rows]
