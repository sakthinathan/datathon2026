'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

const DISTRICTS = ['All','Bengaluru Urban','Mysuru','Hubballi-Dharwad','Mangaluru','Belagavi','Kalaburagi','Ballari','Vijayapura','Shivamogga','Tumakuru','Raichur','Bidar','Yadgir','Dharwad','Gadag','Haveri','Uttara Kannada','Dakshina Kannada','Udupi','Chikkamagaluru','Hassan','Kodagu','Mandya','Chamarajanagar','Ramanagara','Chikkaballapur','Kolar','Bengaluru Rural','Chitradurga','Davanagere','Koppal'];
const RISK_LEVELS = ['All', 'High', 'Medium', 'Low'];

export default function NetworkPage() {
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
  const [stats, setStats] = useState<any>({});
  const [selectedSuspect, setSelectedSuspect] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [district, setDistrict] = useState('All');
  const [riskLevel, setRiskLevel] = useState('All');
  const [ForceGraph, setForceGraph] = useState<any>(null);
  const [limit, setLimit] = useState(80);

  useEffect(() => {
    // Dynamic import to avoid SSR issues
    import('react-force-graph-2d').then(m => setForceGraph(() => m.default));
  }, []);

  const loadGraph = async () => {
    setLoading(true);
    try {
      const data = await api.getNetworkGraph(
        district !== 'All' ? district : undefined,
        riskLevel !== 'All' ? riskLevel : undefined,
        limit
      );
      setGraphData({ nodes: data.nodes, links: data.links });
      setStats(data.stats);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadGraph(); }, [district, riskLevel, limit]);

  const handleNodeClick = async (node: any) => {
    if (node.type === 'suspect') {
      const data = await api.getSuspect(node.id).catch(() => null);
      setSelectedSuspect(data);
    }
  };

  const getNodeColor = (node: any) => node.color || '#6366f1';
  const getNodeLabel = (node: any) => node.name || '';
  const getLinkColor = (link: any) => link.type === 'location' ? 'rgba(129,140,248,0.3)' : 'rgba(239,68,68,0.5)';

  return (
    <div>
      <div className="page-header">
        <div className="page-title"><span className="page-icon">🕸️</span>Criminal Network Analysis</div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <select className="filter-select" value={district} onChange={e => setDistrict(e.target.value)}>
            {DISTRICTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select className="filter-select" value={riskLevel} onChange={e => setRiskLevel(e.target.value)}>
            {RISK_LEVELS.map(r => <option key={r}>{r}</option>)}
          </select>
          <select className="filter-select" value={limit} onChange={e => setLimit(Number(e.target.value))}>
            <option value={40}>40 nodes</option>
            <option value={80}>80 nodes</option>
            <option value={120}>120 nodes</option>
          </select>
        </div>
      </div>

      <div className="page-content" style={{ padding:16 }}>
        {/* Stats Bar */}
        <div style={{ display:'flex', gap:12, marginBottom:16 }}>
          {[
            { label:'Total Suspects', value: stats.total_suspects, color:'var(--accent)' },
            { label:'High Risk', value: stats.high_risk, color:'var(--danger)' },
            { label:'Medium Risk', value: stats.medium_risk, color:'var(--warning)' },
            { label:'Low Risk', value: stats.low_risk, color:'var(--success)' },
            { label:'Connections', value: stats.total_links, color:'var(--info)' },
          ].map((s,i) => (
            <div key={i} className="glass-card" style={{ flex:1, padding:'14px 18px', textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value ?? '—'}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:16, height:'calc(100vh - 240px)' }}>
          {/* Graph */}
          <div className="glass-card network-container" style={{ flex:1, position:'relative', minHeight:500 }}>
            {loading || !ForceGraph ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:16 }}>
                <div className="spinner" style={{ width:40, height:40 }} />
                <div style={{ color:'var(--text-muted)' }}>Loading criminal network...</div>
              </div>
            ) : (
              <ForceGraph
                graphData={graphData}
                nodeLabel={getNodeLabel}
                nodeColor={getNodeColor}
                nodeVal={(n: any) => n.val || 8}
                linkColor={getLinkColor}
                linkWidth={0.8}
                backgroundColor="#030712"
                onNodeClick={handleNodeClick}
                nodeCanvasObject={(node: any, ctx: any, globalScale: number) => {
                  const label = node.name;
                  const fontSize = Math.max(8, 12 / globalScale);
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, node.val || 8, 0, 2 * Math.PI, false);
                  ctx.fillStyle = node.color || '#6366f1';
                  ctx.fill();
                  if (globalScale > 0.8) {
                    ctx.font = `${fontSize}px Inter, sans-serif`;
                    ctx.fillStyle = 'rgba(255,255,255,0.85)';
                    ctx.textAlign = 'center';
                    ctx.fillText(label?.slice(0, 12), node.x, node.y + (node.val || 8) + fontSize);
                  }
                }}
                cooldownTicks={100}
                width={undefined}
                height={undefined}
              />
            )}

            {/* Legend */}
            <div style={{ position:'absolute', bottom:16, left:16, background:'rgba(5,9,20,0.85)', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)' }}>
              <div className="network-legend">
                <div className="legend-item"><div className="legend-dot" style={{ background:'#ef4444' }} />High Risk</div>
                <div className="legend-item"><div className="legend-dot" style={{ background:'#f59e0b' }} />Medium Risk</div>
                <div className="legend-item"><div className="legend-dot" style={{ background:'#22c55e' }} />Low Risk</div>
                <div className="legend-item"><div className="legend-dot" style={{ background:'#818cf8' }} />Location</div>
              </div>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:6 }}>Click a node to view suspect profile</div>
            </div>
          </div>

          {/* Suspect Panel */}
          {selectedSuspect && (
            <div className="glass-card" style={{ width:280, padding:20, overflowY:'auto', position:'relative' }}>
              <button onClick={() => setSelectedSuspect(null)}
                style={{ position:'absolute', top:12, right:12, background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:16 }}>✕</button>
              <div style={{ marginBottom:16 }}>
                <div style={{ width:60, height:60, borderRadius:16, background:`linear-gradient(135deg, ${selectedSuspect.risk_level === 'High' ? '#ef4444' : selectedSuspect.risk_level === 'Medium' ? '#f59e0b' : '#22c55e'}, rgba(0,0,0,0.5))`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, marginBottom:10 }}>
                  🕵️
                </div>
                <div style={{ fontWeight:700, fontSize:16 }}>{selectedSuspect.name}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>{selectedSuspect.alias}</div>
                <div style={{ marginTop:8 }}>
                  <span className={`badge badge-${selectedSuspect.risk_level?.toLowerCase()}`}>{selectedSuspect.risk_level} Risk</span>
                </div>
              </div>
              {[
                ['Age', selectedSuspect.age],
                ['Gender', selectedSuspect.gender],
                ['District', selectedSuspect.district],
                ['Occupation', selectedSuspect.occupation],
                ['Crime Count', selectedSuspect.crime_count],
                ['Connections', selectedSuspect.connection_count],
              ].map(([k,v]) => (
                <div key={k} className="suspect-detail-row">
                  <span className="suspect-detail-label">{k}</span>
                  <span style={{ fontWeight:500, fontSize:13 }}>{v}</span>
                </div>
              ))}

              {selectedSuspect.connections?.length > 0 && (
                <>
                  <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-muted)', marginTop:16, marginBottom:8 }}>Known Associates</div>
                  {selectedSuspect.connections.slice(0,5).map((c: any) => (
                    <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, padding:'6px 10px', background:'var(--bg-glass)', borderRadius:8, cursor:'pointer' }}
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
    </div>
  );
}
