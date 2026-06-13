'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const API_BASE = 'http://localhost:8000';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

async function fetchAuth(path: string) {
  const token = localStorage.getItem('scrb_token');
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

const AMOUNT_FORMAT = (n: number) => {
  if (n >= 10000000) return `₹${(n/10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
  return `₹${n.toLocaleString()}`;
};

export default function FinancialPage() {
  const [summary, setSummary] = useState<any>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
  const [activeTab, setActiveTab] = useState<'transactions'|'graph'>('transactions');
  const [loading, setLoading] = useState(true);
  const graphRef = useRef<any>(null);

  useEffect(() => {
    Promise.all([
      fetchAuth('/financial/summary'),
      fetchAuth('/financial/suspicious-transactions?limit=50'),
      fetchAuth('/financial/network-graph'),
    ]).then(([sum, txns, graph]) => {
      setSummary(sum);
      setTransactions(txns);
      setGraphData(graph);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const STAT_CARDS = [
    { label: 'Total Accounts', value: summary.total_accounts?.toLocaleString(), icon: '🏦', color: '#6366f1' },
    { label: 'Flagged Accounts', value: summary.flagged_accounts?.toLocaleString(), icon: '🚩', color: '#ef4444' },
    { label: 'Total Transactions', value: summary.total_transactions?.toLocaleString(), icon: '💳', color: '#38bdf8' },
    { label: 'Suspicious Txns', value: summary.suspicious_transactions?.toLocaleString(), icon: '⚠️', color: '#f59e0b' },
    { label: 'Suspicious Amount', value: AMOUNT_FORMAT(summary.suspicious_amount || 0), icon: '💰', color: '#a855f7' },
  ];

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = (node.val || 8);
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = node.color || '#6366f1';
    if (node.flagged) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 15;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    if (globalScale > 1.2) {
      ctx.font = `${11/globalScale}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label?.slice(0,10) || '', node.x, node.y + size + 8/globalScale);
    }
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-title"><span className="page-icon">💸</span>Financial Crime Analysis</div>
        <div style={{ display:'flex', gap:8 }}>
          <button className={`btn btn-${activeTab==='transactions'?'primary':'ghost'}`} onClick={() => setActiveTab('transactions')}>⚠️ Suspicious Transactions</button>
          <button className={`btn btn-${activeTab==='graph'?'primary':'ghost'}`} onClick={() => setActiveTab('graph')}>🕸️ Money Trail Network</button>
        </div>
      </div>

      <div className="page-content">
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:80 }}>
            <div className="spinner" style={{ width:40, height:40 }} />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="stats-grid" style={{ marginBottom:24 }}>
              {STAT_CARDS.map((s, i) => (
                <div key={i} className="stat-card fade-in" style={{ '--accent-color': s.color } as any}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value" style={{ color:s.color }}>{s.value ?? '—'}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {activeTab === 'transactions' ? (
              <div className="glass-card" style={{ padding:'20px 0' }}>
                <div style={{ padding:'0 20px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div className="chart-title" style={{ marginBottom:0 }}>🚩 Suspicious Financial Transactions</div>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>
                    {transactions.length} records · flagged by pattern analysis
                  </span>
                </div>
                <div style={{ maxHeight:'calc(100vh - 320px)', overflowY:'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Type</th>
                        <th>From Account</th>
                        <th>From Bank</th>
                        <th>To Account</th>
                        <th>To Bank</th>
                        <th>Suspect</th>
                        <th>Risk</th>
                        <th>Flag Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t: any, i: number) => (
                        <tr key={t.id}>
                          <td style={{ color:'var(--text-muted)' }}>{i+1}</td>
                          <td style={{ fontSize:12, color:'var(--text-muted)' }}>{t.date}</td>
                          <td>
                            <span style={{ fontWeight:700, color: t.amount > 500000 ? 'var(--danger)' : t.amount > 100000 ? 'var(--warning)' : 'var(--text-primary)' }}>
                              {AMOUNT_FORMAT(t.amount)}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, background:'rgba(99,102,241,0.15)', color:'var(--accent-light)', fontWeight:600 }}>
                              {t.transaction_type}
                            </span>
                          </td>
                          <td><code style={{ fontSize:10, color:'#a5f3fc', background:'rgba(0,0,0,0.3)', padding:'1px 5px', borderRadius:3 }}>{t.from_account}</code></td>
                          <td style={{ fontSize:12 }}>{t.from_bank}</td>
                          <td><code style={{ fontSize:10, color:'#fda4af', background:'rgba(0,0,0,0.3)', padding:'1px 5px', borderRadius:3 }}>{t.to_account}</code></td>
                          <td style={{ fontSize:12 }}>{t.to_bank}</td>
                          <td style={{ fontWeight:600, fontSize:12 }}>{t.suspect_name || '—'}</td>
                          <td>
                            {t.risk_level && (
                              <span style={{
                                fontSize:10, padding:'2px 6px', borderRadius:99, fontWeight:700,
                                background: t.risk_level==='High' ? 'rgba(239,68,68,0.15)' : t.risk_level==='Medium' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                                color: t.risk_level==='High' ? 'var(--danger)' : t.risk_level==='Medium' ? 'var(--warning)' : 'var(--success)'
                              }}>{t.risk_level}</span>
                            )}
                          </td>
                          <td style={{ fontSize:11, color:'var(--text-muted)', maxWidth:200 }}>
                            <span title={t.flag_reason}>{t.flag_reason?.slice(0,50)}{t.flag_reason?.length > 50 ? '...' : ''}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div>
                {/* Legend */}
                <div className="glass-card" style={{ padding:'12px 20px', marginBottom:16, display:'flex', gap:24, alignItems:'center' }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>Money Trail Network</div>
                  <div style={{ display:'flex', gap:16, marginLeft:'auto', fontSize:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:12, height:12, borderRadius:'50%', background:'#ef4444', boxShadow:'0 0 8px rgba(239,68,68,0.6)' }} />
                      <span style={{ color:'var(--text-muted)' }}>Flagged Account</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:12, height:12, borderRadius:'50%', background:'#6366f1' }} />
                      <span style={{ color:'var(--text-muted)' }}>Clean Account</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:24, height:2, background:'rgba(239,68,68,0.6)' }} />
                      <span style={{ color:'var(--text-muted)' }}>Suspicious Transfer</span>
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                    {graphData.stats?.flagged_accounts || 0} flagged · {AMOUNT_FORMAT(graphData.stats?.total_suspicious_amount || 0)} suspicious
                  </div>
                </div>

                <div className="glass-card" style={{ height:'70vh', overflow:'hidden', borderRadius:16, position:'relative' }}>
                  {graphData.nodes?.length > 0 ? (
                    <ForceGraph2D
                      ref={graphRef}
                      graphData={graphData}
                      backgroundColor="#0d1117"
                      nodeCanvasObject={nodeCanvasObject}
                      nodePointerAreaPaint={(node: any, color, ctx) => {
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, (node.val || 8) + 4, 0, 2 * Math.PI);
                        ctx.fill();
                      }}
                      linkColor={(link: any) => link.color || 'rgba(99,102,241,0.3)'}
                      linkWidth={(link: any) => link.suspicious ? 2 : 1}
                      linkDirectionalParticles={(link: any) => link.suspicious ? 4 : 0}
                      linkDirectionalParticleColor={(link: any) => '#ef4444'}
                      linkDirectionalParticleSpeed={0.003}
                      nodeLabel={(node: any) => `${node.suspect || 'Unknown'}\n${node.label} (${node.bank})`}
                      onNodeClick={(node: any) => {
                        if (graphRef.current) {
                          graphRef.current.centerAt(node.x, node.y, 500);
                          graphRef.current.zoom(3, 500);
                        }
                      }}
                      width={window?.innerWidth ? window.innerWidth - 280 : 1000}
                      height={window?.innerHeight ? window.innerHeight - 300 : 600}
                    />
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12 }}>
                      <div style={{ fontSize:40 }}>💸</div>
                      <div style={{ color:'var(--text-muted)', fontSize:14 }}>No financial network data available</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
