from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db, Suspect
from routers.auth import get_current_user
from services.network_service import detect_clusters
from typing import Optional

router = APIRouter(prefix="/network", tags=["network"])


@router.get("/graph")
async def get_network_graph(district: Optional[str] = None, risk_level: Optional[str] = None,
                             limit: int = 100, db: Session = Depends(get_db),
                             current_user=Depends(get_current_user)):
    """
    Returns graph nodes + links WITH cluster assignments from NetworkX
    community detection (greedy modularity maximisation).
    Nodes are colour-coded by cluster, kingpins and brokers are flagged.
    """
    result = detect_clusters(db, district=district, risk_level=risk_level, limit=limit)

    # Add location hub nodes (by district) on top of suspect nodes
    suspects_in_result = {n["id"]: n for n in result["nodes"]}
    district_counts: dict[str, int] = {}
    for n in result["nodes"]:
        d = n.get("district", "")
        district_counts[d] = district_counts.get(d, 0) + 1

    LOC_OFFSET = 100000
    loc_nodes  = []
    loc_links  = []
    for i, (dist, cnt) in enumerate(sorted(district_counts.items(), key=lambda x: -x[1])[:8]):
        loc_id = LOC_OFFSET + i
        loc_nodes.append({
            "id": loc_id, "name": dist, "type": "location",
            "color": "#818cf8", "val": 8, "crime_count": cnt,
            "cluster_id": -2,
        })
        for n in result["nodes"]:
            if n.get("district") == dist:
                loc_links.append({
                    "source": n["id"], "target": loc_id,
                    "strength": 0.15, "type": "location",
                    "color": "rgba(129,140,248,0.2)",
                })

    return {
        "nodes":    result["nodes"] + loc_nodes,
        "links":    result["links"] + loc_links,
        "clusters": result["clusters"],
        "stats":    result["stats"],
    }


@router.get("/clusters")
async def get_clusters(district: Optional[str] = None, risk_level: Optional[str] = None,
                       limit: int = 200, db: Session = Depends(get_db),
                       current_user=Depends(get_current_user)):
    """
    Returns only the cluster summary cards (no graph data) —
    used by the cluster panel sidebar.
    """
    result = detect_clusters(db, district=district, risk_level=risk_level, limit=limit)
    return {
        "clusters": result["clusters"],
        "stats":    result["stats"],
    }


@router.get("/suspect/{suspect_id}")
async def get_suspect(suspect_id: int, db: Session = Depends(get_db),
                      current_user=Depends(get_current_user)):
    suspect = db.query(Suspect).filter(Suspect.id == suspect_id).first()
    if not suspect:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Suspect not found")

    connections = []
    conn_ids = []
    if suspect.connections:
        conn_ids = [int(x.strip()) for x in suspect.connections.split(",") if x.strip().isdigit()]
        connected = db.query(Suspect).filter(Suspect.id.in_(conn_ids[:10])).all()
        connections = [{"id": c.id, "name": c.name, "risk_level": c.risk_level,
                        "district": c.district} for c in connected]

    crime_ids = suspect.crime_history.split(",") if suspect.crime_history else []
    return {
        "id":              suspect.id,
        "name":            suspect.name,
        "alias":           suspect.alias,
        "age":             suspect.age,
        "gender":          suspect.gender,
        "district":        suspect.district,
        "occupation":      suspect.occupation,
        "risk_level":      suspect.risk_level,
        "crime_count":     len(crime_ids),
        "connections":     connections,
        "connection_count": len(conn_ids),
    }


@router.get("/community-clusters")
async def community_clusters(db: Session = Depends(get_db),
                              current_user=Depends(get_current_user)):
    """Legacy endpoint — returns cluster stats (kept for backward compat)."""
    result = detect_clusters(db, limit=200)
    return result["clusters"]
