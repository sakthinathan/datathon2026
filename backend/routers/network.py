from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, Suspect
from routers.auth import get_current_user
from typing import Optional

router = APIRouter(prefix="/network", tags=["network"])

@router.get("/graph")
async def get_network_graph(district: Optional[str] = None, risk_level: Optional[str] = None,
                             limit: int = 80, db: Session = Depends(get_db),
                             current_user=Depends(get_current_user)):
    q = db.query(Suspect)
    if district and district != "All":
        q = q.filter(Suspect.district == district)
    if risk_level and risk_level != "All":
        q = q.filter(Suspect.risk_level == risk_level)
    suspects = q.limit(limit).all()

    nodes = []
    links = []
    suspect_ids = {s.id for s in suspects}
    id_map = {s.id: i for i, s in enumerate(suspects)}

    COLOR_MAP = {"High": "#ef4444", "Medium": "#f59e0b", "Low": "#22c55e"}
    SIZE_MAP = {"High": 18, "Medium": 14, "Low": 10}

    for s in suspects:
        crime_count = len(s.crime_history.split(",")) if s.crime_history else 0
        nodes.append({
            "id": s.id,
            "name": s.name,
            "alias": s.alias,
            "age": s.age,
            "gender": s.gender,
            "district": s.district,
            "occupation": s.occupation,
            "risk_level": s.risk_level,
            "crime_count": crime_count,
            "color": COLOR_MAP.get(s.risk_level, "#6366f1"),
            "val": SIZE_MAP.get(s.risk_level, 10),
            "type": "suspect"
        })

    seen_links = set()
    for s in suspects:
        if s.connections:
            for conn_id_str in s.connections.split(","):
                try:
                    conn_id = int(conn_id_str.strip())
                    if conn_id in suspect_ids and conn_id != s.id:
                        link_key = tuple(sorted([s.id, conn_id]))
                        if link_key not in seen_links:
                            seen_links.add(link_key)
                            links.append({
                                "source": s.id,
                                "target": conn_id,
                                "strength": 0.5,
                                "type": "associate"
                            })
                except ValueError:
                    continue

    # Add location nodes for top districts
    district_counts = {}
    for s in suspects:
        district_counts[s.district] = district_counts.get(s.district, 0) + 1

    location_id_offset = 100000
    for i, (dist, count) in enumerate(sorted(district_counts.items(), key=lambda x: -x[1])[:8]):
        loc_id = location_id_offset + i
        nodes.append({
            "id": loc_id,
            "name": dist,
            "type": "location",
            "color": "#818cf8",
            "val": 8,
            "crime_count": count
        })
        for s in suspects:
            if s.district == dist:
                links.append({"source": s.id, "target": loc_id, "strength": 0.2, "type": "location"})

    return {
        "nodes": nodes,
        "links": links,
        "stats": {
            "total_suspects": len(suspects),
            "total_links": len(seen_links),
            "high_risk": sum(1 for s in suspects if s.risk_level == "High"),
            "medium_risk": sum(1 for s in suspects if s.risk_level == "Medium"),
            "low_risk": sum(1 for s in suspects if s.risk_level == "Low"),
        }
    }

@router.get("/suspect/{suspect_id}")
async def get_suspect(suspect_id: int, db: Session = Depends(get_db),
                      current_user=Depends(get_current_user)):
    suspect = db.query(Suspect).filter(Suspect.id == suspect_id).first()
    if not suspect:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Suspect not found")

    # Get connected suspects
    connections = []
    if suspect.connections:
        conn_ids = [int(x.strip()) for x in suspect.connections.split(",") if x.strip().isdigit()]
        connected = db.query(Suspect).filter(Suspect.id.in_(conn_ids[:10])).all()
        connections = [{"id": c.id, "name": c.name, "risk_level": c.risk_level, "district": c.district} for c in connected]

    crime_ids = suspect.crime_history.split(",") if suspect.crime_history else []
    return {
        "id": suspect.id,
        "name": suspect.name,
        "alias": suspect.alias,
        "age": suspect.age,
        "gender": suspect.gender,
        "district": suspect.district,
        "occupation": suspect.occupation,
        "risk_level": suspect.risk_level,
        "crime_count": len(crime_ids),
        "connections": connections,
        "connection_count": len(conn_ids) if suspect.connections else 0,
    }

@router.get("/community-clusters")
async def community_clusters(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    result = db.execute(text(
        "SELECT district, risk_level, COUNT(*) as count, occupation "
        "FROM suspects GROUP BY district, risk_level ORDER BY count DESC LIMIT 30"
    ))
    rows = result.fetchall()
    return [{"district": r[0], "risk_level": r[1], "count": r[2], "occupation": r[3]} for r in rows]
