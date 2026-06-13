'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

const DISTRICTS = ['All','Bengaluru Urban','Mysuru','Hubballi-Dharwad','Mangaluru','Belagavi','Kalaburagi','Ballari','Vijayapura','Shivamogga','Tumakuru','Raichur','Bidar','Yadgir','Dharwad','Gadag','Haveri','Uttara Kannada','Dakshina Kannada','Udupi','Chikkamagaluru','Hassan','Kodagu','Mandya','Chamarajanagar','Ramanagara','Chikkaballapur','Kolar','Bengaluru Rural','Chitradurga','Davanagere','Koppal'];
const RISK_LEVELS = ['All', 'High', 'Medium', 'Low'];
const THREAT_COLORS: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#22c55e' };

const API_BASE = 'http://localhost:8000';
async function fetchAuth(path: string) {
  const token = localStorage.getItem('scrb_token');
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

export default function NetworkPage() {
  const [graphData, setGraphData]       = useState<any>({ nodes: [], links: [] });
  const [clusters, setClusters]         = useState<any[]>([]);
  const [stats, setStats]               = useState<any>({});
  const [selectedSuspect, setSelectedSuspect] = useState<any>(null);
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [loading, setLoading]           = useState(true);
  const [district, setDistrict]         = useState('All');
  const [riskLevel, setRiskLevel]       = useState('All');
  const [limit, setLimit]               = useState(100);
  const [activeTab, setActiveTab]       = useState<'graph' | 'clusters'>('graph');
  const [ForceGraph, setForceGraph]     = useState<any>(null);

  useEffect(() => {
    import('react-force-graph-2d').then(m => setForceGraph(() => m.default));
  }, []);

  const loadGraph = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (district !== 'All') params.append('district', district);
      if (riskLevel !== 'All') params.append('risk_level', riskLevel);
      params.append('limit', String(limit));
      const data = await fetchAuth(`/network/graph?${params}`);
      setGraphData({ nodes: data.nodes || [], links: data.links || [] });
      setClusters(data.clusters || []);
      setStats(data.stats || {});
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadGraph(); }, [district, riskLevel, limit]);

  const handleNodeClick = async (node: any) => {
    if (node.type === 'suspect') {
      const data = await api.getSuspect(node.id).catch(() => null);
      setSelectedSuspect(data);
      setSelectedCluster(null);
    }
  };

  const getNodeColor = (node: any) => {
    if (selectedCluster !== null && node.cluster_id !== selectedCluster && node.type === 'suspect')
      return 'rgba(100,100,120,0.3)';
    return node.color || '#6366f1';
  };

  const getLinkColor = (link: any) => {
    if (selectedCluster !== null) {
      const src = graphData.nodes.find((n: any) => n.id === (link.source?.id ?? link.source));
      if (src?.cluster_id !== selectedCluster) return 'rgba(100,100,120,0.05)';
    }
    return link.color || 'rgba(239,68,68,0.5)';
  };

  const nodeCanvasObject = (node: any, ctx: any, globalScale: number) => {
    const label = node.name;
    const r = node.val || 8;
    const fontSize = Math.max(8, 12 / globalScale);

    // Draw glow for kingpin
    if (node.is_kingpin) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,215,0,0.18)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = getNodeColor(node);
    ctx.fill();

    // Crown for kingpin
    if (node.is_kingpin && globalScale > 0.5) {
      ctx.font = `${Math.max(10, 16/globalScale)}px sans-serif`;
      ctx.fillText('👑', node.x - 6/globalScale, node.y - r - 2/globalScale);
    }
    // Star for broker
    if (node.is_broker && !node.is_kingpin && globalScale > 0.5) {
      ctx.font = `${Math.max(8, 12/globalScale)}px sans-serif`;
      ctx.fillText('⭐', node.x - 5/globalScale, node.y - r - 1/globalScale);
    }

    if (globalScale > 0.7 && node.type !== 'location') {
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(label?.slice(0, 12), node.x, node.y + r + fontSize);
    } else if (node.type === 'location' && globalScale > 0.4) {
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = '#a5b4fc';
      ctx.textAlign = 'center';
      ctx.fillText(label?.slice(0, 14), node.x, node.y + r + fontSize);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title"><span className="page-icon">🕸️</span>Criminal Network Analysis
          <span style={{ fontSize:11, color:'var(--success)', fontWeight:500, padding:'2px 8px', background:'rgba(34,197,94,0.1)', borderRadius:99, border:'1px solid rgba(34,197,94,0.2)', marginLeft:8 }}>
            ML Clustering
          </span>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <select className="filter-select" value={district} onChange={e => setDistrict(e.target.value)}>
            {DISTRICTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select className="filter-select" value={riskLevel} onChange={e => setRiskLevel(e.target.value)}>
            {RISK_LEVELS.map(r => <option key={r}>{r}</option>)}
          </select>
          <select className="filter-select" value={limit} onChange={e => setLimit(Number(e.target.value))}>
            <option value={60}>60 nodes</option>
            <option value={100}>100 nodes</option>
            <option value={150}>150 nodes</option>
          </select>
          <div style={{ display:'flex', background:'var(--bg-glass)', borderRadius:8, border:'1px solid var(--border)' }}>
            {(['graph','clusters'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                style={{ padding:'6px 16px', fontSize:12, fontWeight:600, background: activeTab===t ? 'var(--accent)' : 'none',
                  color: activeTab===t ? '#fff' : 'var(--text-muted)', border:'none', borderRadius:8, cursor:'pointer', transition:'all 0.2s' }}>
                {t === 'graph' ? '🕸️ Graph' : `🔗 Clusters (${clusters.length})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-content" style={{ padding:16 }}>
        {/* Stats Bar */}
        <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
          {[
            { label:'Total Suspects', value: stats.total_suspects, color:'var(--accent)' },
            { label:'High Risk',      value: stats.high_risk,      color:'var(--danger)' },
            { label:'Connections',    value: stats.total_links,    color:'var(--info)' },
            { label:'Clusters Found', value: stats.total_clusters, color:'#f59e0b' },
            { label:'Critical Gangs', value: stats.critical_clusters, color:'#ef4444' },
            { label:'Inter-District', value: stats.inter_district_gangs, color:'#8b5cf6' },
          ].map((s,i) => (
            <div key={i} className="glass-card" style={{ flex:1, minWidth:110, padding:'12px 16px', textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value ?? '—'}</div>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {activeTab === 'graph' ? (
          <div style={{ display:'flex', gap:16, height:'calc(100vh - 260px)' }}>
            {/* Force Graph */}
            <div className="glass-card network-container" style={{ flex:1, position:'relative', minHeight:500 }}>
              {loading || !ForceGraph ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:16 }}>
                  <div className="spinner" style={{ width:40, height:40 }} />
                  <div style={{ color:'var(--text-muted)' }}>Running ML community detection...</div>
                </div>
              ) : (
                <ForceGraph
                  graphData={graphData}
                  nodeLabel={(n: any) => `${n.name} | ${n.risk_level} | Cluster ${n.cluster_id ?? 'N/A'}${n.is_kingpin ? ' 👑 Kingpin' : ''}${n.is_broker ? ' ⭐ Broker' : ''}`}
                  nodeColor={getNodeColor}
                  nodeVal={(n: any) => n.val || 8}
                  linkColor={getLinkColor}
                  linkWidth={(l: any) => l.type === 'intra_cluster' ? 1.5 : 0.5}
                  backgroundColor="#030712"
                  onNodeClick={handleNodeClick}
                  nodeCanvasObject={nodeCanvasObject}
                  cooldownTicks={120}
                />
              )}

              {/* Legend */}
              <div style={{ position:'absolute', bottom:16, left:16, background:'rgba(5,9,20,0.9)', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase' }}>Legend</div>
                <div className="network-legend">
                  <div className="legend-item"><div className="legend-dot" style={{ background:'#ef4444' }} />High Risk</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background:'#f59e0b' }} />Medium Risk</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background:'#22c55e' }} />Low Risk</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background:'#818cf8' }} />Location</div>
                </div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:6 }}>👑 Kingpin  ⭐ Broker  Same colour = Same gang</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>Click cluster in sidebar to highlight</div>
              </div>
            </div>

            {/* Right Panel: Cluster List or Suspect Detail */}
            <div style={{ width:300, display:'flex', flexDirection:'column', gap:12, overflowY:'auto' }}>
              {/* Cluster cards */}
              {!selectedSuspect && clusters.slice(0, 8).map((c: any) => (
                <div key={c.cluster_id} className="glass-card"
                  style={{ padding:'12px 14px', cursor:'pointer', border:`1px solid ${selectedCluster === c.cluster_id ? c.color : 'var(--border)'}`, transition:'all 0.2s' }}
                  onClick={() => setSelectedCluster(selectedCluster === c.cluster_id ? null : c.cluster_id)}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:c.color }} />
                      <span style={{ fontWeight:700, fontSize:13 }}>Gang #{c.cluster_id + 1}</span>
                      {c.is_inter_district && <span style={{ fontSize:9, padding:'1px 5px', background:'rgba(139,92,246,0.2)', color:'#a78bfa', borderRadius:4, border:'1px solid rgba(139,92,246,0.3)' }}>INTER-DISTRICT</span>}
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:99, background:`${THREAT_COLORS[c.threat_level]}22`, color:THREAT_COLORS[c.threat_level], border:`1px solid ${THREAT_COLORS[c.threat_level]}44` }}>
                      {c.threat_level}
                    </span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>
                    {c.size} members · {c.district_count} district{c.district_count>1?'s':''} · {c.total_crimes} crimes
                  </div>
                  <div style={{ fontSize:11 }}>
                    👑 <strong>{c.kingpin?.name}</strong> <span style={{ color:'var(--text-muted)' }}>({c.kingpin?.risk_level})</span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>
                    Cohesion: {(c.cluster_coefficient * 100).toFixed(0)}% · Risk Score: {c.risk_score}
                  </div>
                </div>
              ))}

              {/* Suspect detail panel */}
              {selectedSuspect && (
                <div className="glass-card" style={{ padding:16, position:'relative' }}>
                  <button onClick={() => setSelectedSuspect(null)}
                    style={{ position:'absolute', top:10, right:10, background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:16 }}>✕</button>
                  <div style={{ width:56, height:56, borderRadius:14, background:`linear-gradient(135deg, ${selectedSuspect.risk_level === 'High' ? '#ef4444' : selectedSuspect.risk_level === 'Medium' ? '#f59e0b' : '#22c55e'}, rgba(0,0,0,0.5))`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, marginBottom:10 }}>🕵️</div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{selectedSuspect.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>{selectedSuspect.alias}</div>
                  <span className={`badge badge-${selectedSuspect.risk_level?.toLowerCase()}`}>{selectedSuspect.risk_level} Risk</span>
                  <div style={{ marginTop:12 }}>
                    {[['Age', selectedSuspect.age], ['Gender', selectedSuspect.gender], ['District', selectedSuspect.district],
                      ['Occupation', selectedSuspect.occupation], ['Crimes', selectedSuspect.crime_count], ['Connections', selectedSuspect.connection_count]]
                      .map(([k,v]) => (
                        <div key={k} className="suspect-detail-row">
                          <span className="suspect-detail-label">{k}</span>
                          <span style={{ fontWeight:500, fontSize:13 }}>{v}</span>
                        </div>
                    ))}
                  </div>
                  {selectedSuspect.connections?.length > 0 && (
                    <>
                      <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', color:'var(--text-muted)', marginTop:14, marginBottom:8 }}>Known Associates</div>
                      {selectedSuspect.connections.slice(0,5).map((c: any) => (
                        <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, padding:'5px 8px', background:'var(--bg-glass)', borderRadius:8, cursor:'pointer' }}
                          onClick={() => api.getSuspect(c.id).then(setSelectedSuspect)}>
                          <span className={`badge badge-${c.risk_level?.toLowerCase()}`} style={{ fontSize:9 }}>●</span>
                          <div>
                            <div style={{ fontSize:12, fontWeight:500 }}>{c.name}</div>
                            <div style={{ fontSize:10, color:'var(--text-muted)' }}>{c.district}</div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Clusters Tab — full table */
          <div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>
              Detected by <strong style={{ color:'var(--accent-light)' }}>NetworkX Greedy Modularity Maximisation</strong> — nodes of same colour belong to the same criminal network.
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:14 }}>
              {clusters.map((c: any) => (
                <div key={c.cluster_id} className="glass-card" style={{ padding:18, borderLeft:`3px solid ${c.color}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:12, height:12, borderRadius:'50%', background:c.color }} />
                        <span style={{ fontWeight:800, fontSize:15 }}>Gang #{c.cluster_id + 1}</span>
                        {c.is_inter_district && (
                          <span style={{ fontSize:9, padding:'2px 6px', background:'rgba(139,92,246,0.15)', color:'#a78bfa', borderRadius:4, border:'1px solid rgba(139,92,246,0.3)' }}>
                            🌐 INTER-DISTRICT
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>
                        {c.size} members · {c.total_crimes} total crimes
                      </div>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:99,
                      background:`${THREAT_COLORS[c.threat_level]}20`, color:THREAT_COLORS[c.threat_level],
                      border:`1px solid ${THREAT_COLORS[c.threat_level]}40` }}>
                      {c.threat_level}
                    </span>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                    {[
                      ['Risk Score', c.risk_score],
                      ['High Risk Members', c.high_risk_count],
                      ['Districts Spanned', c.district_count],
                      ['Cohesion', `${(c.cluster_coefficient * 100).toFixed(0)}%`],
                    ].map(([k,v]) => (
                      <div key={k} style={{ background:'var(--bg-glass)', borderRadius:8, padding:'8px 10px' }}>
                        <div style={{ fontSize:10, color:'var(--text-muted)' }}>{k}</div>
                        <div style={{ fontSize:16, fontWeight:700 }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize:12, padding:'8px 10px', background:'rgba(255,215,0,0.05)', borderRadius:8, border:'1px solid rgba(255,215,0,0.15)', marginBottom:8 }}>
                    👑 <strong>Kingpin:</strong> {c.kingpin?.name} ({c.kingpin?.risk_level} Risk)
                  </div>

                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                    Districts: {c.districts?.slice(0,4).join(', ')}{c.districts?.length > 4 ? ` +${c.districts.length - 4} more` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
