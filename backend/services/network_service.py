"""
Network Clustering Engine — SCRB CrimeIntel
============================================
Detects criminal gangs / organized crime groups using graph-based
community detection on the suspect connections graph.

Algorithms used:
  - Greedy Modularity Maximisation (networkx.community.greedy_modularity_communities)
    → fast, good quality for medium graphs (< 10k nodes)
  - Degree Centrality  → identifies the "kingpin" of each cluster
  - Betweenness Centrality (sampled) → broker/connector suspects
  - Clustering Coefficient → clique tightness per cluster

Returns clusters sorted by size + risk score descending.
"""

import networkx as nx
from networkx.algorithms import community as nx_community
from networkx.algorithms.centrality import degree_centrality, betweenness_centrality
import numpy as np
from sqlalchemy.orm import Session
from database import Suspect


# ─── Risk weights ─────────────────────────────────────────────────────────────
RISK_WEIGHT = {"High": 3, "Medium": 2, "Low": 1}
COLOR_MAP   = {
    0:  "#ef4444", 1:  "#f59e0b", 2:  "#22c55e", 3:  "#6366f1",
    4:  "#ec4899", 5:  "#14b8a6", 6:  "#f97316", 7:  "#8b5cf6",
    8:  "#06b6d4", 9:  "#84cc16", 10: "#e11d48", 11: "#0ea5e9",
}


def _build_graph(suspects: list[Suspect]) -> nx.Graph:
    """Build an undirected NetworkX graph from suspect connection data."""
    G = nx.Graph()
    id_set = {s.id for s in suspects}

    for s in suspects:
        crime_count = len(s.crime_history.split(",")) if s.crime_history else 0
        G.add_node(s.id,
                   name=s.name,
                   alias=s.alias or "",
                   age=s.age or 0,
                   gender=s.gender or "",
                   district=s.district or "",
                   occupation=s.occupation or "",
                   risk_level=s.risk_level or "Low",
                   crime_count=crime_count,
                   risk_weight=RISK_WEIGHT.get(s.risk_level, 1))

    for s in suspects:
        if s.connections:
            for cid_str in s.connections.split(","):
                try:
                    cid = int(cid_str.strip())
                    if cid in id_set and cid != s.id:
                        G.add_edge(s.id, cid)
                except ValueError:
                    continue

    return G


def detect_clusters(db: Session, district: str | None = None,
                    risk_level: str | None = None,
                    limit: int = 200) -> dict:
    """
    Main entry point. Loads suspects, builds graph, runs community
    detection and centrality analysis. Returns cluster + node data.
    """
    q = db.query(Suspect)
    if district and district != "All":
        q = q.filter(Suspect.district == district)
    if risk_level and risk_level != "All":
        q = q.filter(Suspect.risk_level == risk_level)
    suspects = q.limit(limit).all()

    if not suspects:
        return {"clusters": [], "nodes": [], "links": [], "stats": {}}

    G = _build_graph(suspects)

    # Remove isolated nodes for clustering (keep them for display)
    G_connected = G.copy()
    isolates = list(nx.isolates(G_connected))
    G_connected.remove_nodes_from(isolates)

    # ── Community detection ──────────────────────────────────────────────────
    clusters_raw: list[frozenset] = []
    if G_connected.number_of_nodes() >= 2:
        try:
            clusters_raw = list(nx_community.greedy_modularity_communities(G_connected))
        except Exception:
            clusters_raw = []

    # Assign cluster IDs to nodes
    node_cluster: dict[int, int] = {}
    for cid, members in enumerate(clusters_raw):
        for nid in members:
            node_cluster[nid] = cid
    # Isolated nodes get cluster id = -1
    for nid in isolates:
        node_cluster[nid] = -1

    # ── Centrality (on connected subgraph only) ──────────────────────────────
    deg_cent = {}
    bet_cent = {}
    if G_connected.number_of_nodes() >= 2:
        deg_cent = degree_centrality(G_connected)
        # Use k-sample for large graphs to stay fast
        k = min(50, G_connected.number_of_nodes())
        bet_cent = betweenness_centrality(G_connected, k=k, normalized=True)

    # ── Build node list with cluster + centrality enrichment ─────────────────
    nodes = []
    for s in suspects:
        cid   = node_cluster.get(s.id, -1)
        color = COLOR_MAP.get(cid % 12, "#6366f1") if cid >= 0 else "#475569"
        nodes.append({
            "id":             s.id,
            "name":           s.name,
            "alias":          s.alias or "",
            "age":            s.age,
            "gender":         s.gender,
            "district":       s.district,
            "occupation":     s.occupation,
            "risk_level":     s.risk_level,
            "crime_count":    len(s.crime_history.split(",")) if s.crime_history else 0,
            "cluster_id":     cid,
            "color":          color,
            "val":            {"High": 18, "Medium": 14, "Low": 10}.get(s.risk_level, 10),
            "type":           "suspect",
            "degree_centrality":      round(deg_cent.get(s.id, 0), 4),
            "betweenness_centrality": round(bet_cent.get(s.id, 0), 4),
            "is_kingpin":     False,   # set below
            "is_broker":      False,
        })

    # ── Mark kingpin (highest degree in cluster) and broker (highest betweenness) ─
    node_by_id = {n["id"]: n for n in nodes}
    for cid_idx, members in enumerate(clusters_raw):
        if not members:
            continue
        member_list = [node_by_id[m] for m in members if m in node_by_id]
        if not member_list:
            continue
        # Kingpin = highest degree centrality
        kingpin = max(member_list, key=lambda n: n["degree_centrality"])
        kingpin["is_kingpin"] = True
        kingpin["val"] = 26  # Larger node

        # Broker = highest betweenness (if different from kingpin)
        broker = max(member_list, key=lambda n: n["betweenness_centrality"])
        if broker["id"] != kingpin["id"] and broker["betweenness_centrality"] > 0.01:
            broker["is_broker"] = True
            broker["val"] = max(broker["val"], 20)

    # ── Build links ──────────────────────────────────────────────────────────
    seen  = set()
    links = []
    for s in suspects:
        if s.connections:
            for cid_str in s.connections.split(","):
                try:
                    cid = int(cid_str.strip())
                    if cid in {ss.id for ss in suspects} and cid != s.id:
                        lk = tuple(sorted([s.id, cid]))
                        if lk not in seen:
                            seen.add(lk)
                            same_cluster = node_cluster.get(s.id, -2) == node_cluster.get(cid, -3) \
                                           and node_cluster.get(s.id, -1) >= 0
                            links.append({
                                "source":       s.id,
                                "target":       cid,
                                "strength":     0.8 if same_cluster else 0.3,
                                "type":         "intra_cluster" if same_cluster else "inter_cluster",
                                "color":        "rgba(239,68,68,0.7)" if same_cluster else "rgba(148,163,184,0.25)",
                            })
                except ValueError:
                    continue

    # ── Build cluster summary cards ──────────────────────────────────────────
    cluster_cards = []
    for cid_idx, members in enumerate(clusters_raw):
        member_nodes = [node_by_id[m] for m in members if m in node_by_id]
        if not member_nodes:
            continue

        risk_score = sum(RISK_WEIGHT.get(n["risk_level"], 1) for n in member_nodes)
        high_count = sum(1 for n in member_nodes if n["risk_level"] == "High")
        districts  = list({n["district"] for n in member_nodes})
        kingpin_node = next((n for n in member_nodes if n["is_kingpin"]), member_nodes[0])

        # Gang threat level
        avg_risk = risk_score / len(member_nodes)
        threat = "CRITICAL" if avg_risk >= 2.5 else ("HIGH" if avg_risk >= 1.8 else "MEDIUM")

        # Clustering coefficient for this subgraph
        subgraph = G.subgraph(list(members))
        cluster_coeff = round(nx.average_clustering(subgraph), 3) if subgraph.number_of_nodes() > 1 else 0.0

        cluster_cards.append({
            "cluster_id":       cid_idx,
            "color":            COLOR_MAP.get(cid_idx % 12, "#6366f1"),
            "size":             len(member_nodes),
            "risk_score":       risk_score,
            "threat_level":     threat,
            "high_risk_count":  high_count,
            "districts":        districts,
            "district_count":   len(districts),
            "is_inter_district": len(districts) > 1,
            "kingpin":          {"id": kingpin_node["id"], "name": kingpin_node["name"],
                                 "risk_level": kingpin_node["risk_level"]},
            "cluster_coefficient": cluster_coeff,
            "total_crimes":    sum(n["crime_count"] for n in member_nodes),
        })

    cluster_cards.sort(key=lambda x: (x["risk_score"], x["size"]), reverse=True)

    # ── Stats ────────────────────────────────────────────────────────────────
    inter_district_clusters = sum(1 for c in cluster_cards if c["is_inter_district"])
    stats = {
        "total_suspects":        len(suspects),
        "total_clusters":        len(cluster_cards),
        "total_links":           len(links),
        "high_risk":             sum(1 for s in suspects if s.risk_level == "High"),
        "medium_risk":           sum(1 for s in suspects if s.risk_level == "Medium"),
        "low_risk":              sum(1 for s in suspects if s.risk_level == "Low"),
        "isolated_suspects":     len(isolates),
        "inter_district_gangs":  inter_district_clusters,
        "largest_cluster_size":  cluster_cards[0]["size"] if cluster_cards else 0,
        "critical_clusters":     sum(1 for c in cluster_cards if c["threat_level"] == "CRITICAL"),
    }

    return {
        "clusters": cluster_cards,
        "nodes":    nodes,
        "links":    links,
        "stats":    stats,
    }
