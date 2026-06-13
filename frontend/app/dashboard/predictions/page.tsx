'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

const DISTRICTS = ['All','Bengaluru Urban','Mysuru','Hubballi-Dharwad','Mangaluru','Belagavi','Kalaburagi','Ballari','Vijayapura','Shivamogga','Tumakuru','Raichur','Bidar','Yadgir','Dharwad','Gadag','Haveri','Uttara Kannada','Dakshina Kannada','Udupi','Chikkamagaluru','Hassan','Kodagu','Mandya','Chamarajanagar','Ramanagara','Chikkaballapur','Kolar','Bengaluru Rural','Chitradurga','Davanagere','Koppal'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', fontSize:12 }}>
      <div style={{ fontWeight:600, marginBottom:6 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color:p.color }}>{p.name}: <strong>{p.value?.toLocaleString()}</strong></div>
      ))}
    </div>
  );
};

const API_BASE = 'http://localhost:8000';

async function fetchAuth(path: string) {
  const token = localStorage.getItem('scrb_token');
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

export default function PredictionsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [hotspots, setHotspots] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [earlyWarnings, setEarlyWarnings] = useState<any[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('Bengaluru Urban');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getPredictionSummary(),
      api.getHotspots(),
      fetchAuth('/predictions/early-warnings'),
    ]).then(([sum, hs, ew]) => {
      setSummary(sum); setHotspots(hs);
      setEarlyWarnings(ew || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.getAlerts(filterSeverity !== 'All' ? filterSeverity : undefined,
                  filterDistrict !== 'All' ? filterDistrict : undefined)
       .then(setAlerts).catch(() => {});
  }, [filterSeverity, filterDistrict]);

  useEffect(() => {
    api.getDistrictForecast(selectedDistrict).then(setForecast).catch(() => {});
  }, [selectedDistrict]);


  const severityIcon: any = { Critical:'🔴', Warning:'🟡', Normal:'🟢' };
  const trendIcon: any = { Rising:'📈', Falling:'📉', Stable:'➡️' };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <span className="page-icon">🔮</span>
          Predictive Analytics
          <span style={{ fontSize:12, padding:'3px 10px', background:'rgba(239,68,68,0.15)', color:'var(--danger)', borderRadius:99, border:'1px solid rgba(239,68,68,0.3)', fontWeight:600 }}>
            {summary.critical || 0} Critical Alerts
          </span>
        </div>
      </div>

      <div className="page-content">
        {/* Summary Cards */}
        <div className="stats-grid" style={{ marginBottom:24 }}>
          {[
            { label:'Total Alerts', value: summary.total_alerts, icon:'🔔', color:'var(--accent)', accent:'rgba(99,102,241,0.2)' },
            { label:'Critical', value: summary.critical, icon:'🔴', color:'var(--danger)', accent:'rgba(239,68,68,0.2)' },
            { label:'Warning', value: summary.warning, icon:'🟡', color:'var(--warning)', accent:'rgba(245,158,11,0.2)' },
            { label:'Normal', value: summary.normal, icon:'🟢', color:'var(--success)', accent:'rgba(34,197,94,0.2)' },
            { label:'Rising Trend', value: summary.rising_trend, icon:'📈', color:'var(--danger)', accent:'rgba(239,68,68,0.15)' },
          ].map((s,i) => (
            <div key={i} className="stat-card fade-in" style={{ '--accent-color': s.color } as any}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value" style={{ color:s.color }}>{s.value ?? '—'}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Early Warning Live Feed */}
        {earlyWarnings.length > 0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--danger)', boxShadow:'0 0 10px rgba(239,68,68,0.8)' }} />
              <div style={{ fontWeight:700, fontSize:14, color:'var(--danger)' }}>⚡ Live Early Warning Feed</div>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>High-confidence rising threats — immediate action required</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:12 }}>
              {earlyWarnings.map((w: any) => (
                <div key={w.id} className="fade-in" style={{
                  background: w.urgency === 'IMMEDIATE' ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.07)',
                  border: `1px solid ${w.urgency === 'IMMEDIATE' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  borderRadius:12, padding:14
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13 }}>{w.district}</div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{w.crime_type}</div>
                    </div>
                    <span style={{
                      fontSize:10, padding:'2px 8px', borderRadius:99, fontWeight:800,
                      background: w.urgency === 'IMMEDIATE' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                      color: w.urgency === 'IMMEDIATE' ? 'var(--danger)' : 'var(--warning)',
                    }}>{w.urgency}</span>
                  </div>
                  <div style={{ display:'flex', gap:10, fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>
                    <span>📈 {w.trend}</span>
                    <span>🎯 {Math.round(w.confidence * 100)}%</span>
                    <span>⚠️ {w.predicted_count} cases</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--accent-light)', background:'rgba(99,102,241,0.08)', borderRadius:6, padding:'5px 10px', borderLeft:'2px solid var(--accent)' }}>
                    → {w.recommended_action}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="chart-grid" style={{ marginBottom:24 }}>
          {/* Alerts List */}

          <div className="glass-card" style={{ padding:20 }}>
            <div className="chart-title">⚠️ Active Alerts</div>
            <div className="filters-row" style={{ marginBottom:12 }}>
              <select className="filter-select" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
                <option>All</option><option>Critical</option><option>Warning</option><option>Normal</option>
              </select>
              <select className="filter-select" value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
                {DISTRICTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ maxHeight:420, overflowY:'auto' }}>
              {alerts.slice(0,20).map((a: any) => (
                <div key={a.id} className={`alert-card ${a.severity}`}>
                  <div className="alert-header">
                    <div className="alert-title">{severityIcon[a.severity]} {a.district} — {a.crime_type}</div>
                    <span className={`badge badge-${a.severity.toLowerCase()}`}>{a.severity}</span>
                  </div>
                  <div className="alert-meta">
                    <span>📍 Predicted: <strong>{a.predicted_count}</strong> cases</span>
                    <span>🎯 Confidence: {Math.round(a.confidence * 100)}%</span>
                    <span>{trendIcon[a.trend]} {a.trend}</span>
                  </div>
                  <div style={{ marginTop:8 }}>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width:`${a.confidence*100}%`,
                        background: a.severity === 'Critical' ? 'var(--danger)' : a.severity === 'Warning' ? 'var(--warning)' : 'var(--success)' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hotspot Bars */}
          <div className="glass-card chart-container">
            <div className="chart-title">🔥 Top Hotspots</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={hotspots.slice(0,8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill:'#64748b', fontSize:11 }} />
                <YAxis dataKey="district" type="category" tick={{ fill:'#94a3b8', fontSize:11 }} width={120} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="predicted_count" name="Predicted Cases" radius={[0,4,4,0]}>
                  {hotspots.slice(0,8).map((h: any, i: number) => (
                    <Cell key={i} fill={h.severity === 'Critical' ? '#ef4444' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* District Forecast */}
            <div style={{ marginTop:20 }}>
              <div className="chart-title" style={{ marginBottom:12 }}>📈 6-Month Forecast</div>
              <div style={{ marginBottom:10 }}>
                <select className="filter-select" value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} style={{ width:'100%' }}>
                  {DISTRICTS.filter(d => d !== 'All').map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              {forecast && (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={forecast.forecast}>
                    <defs>
                      <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill:'#64748b', fontSize:10 }} />
                    <YAxis tick={{ fill:'#64748b', fontSize:10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="predicted" stroke="#6366f1" fill="url(#fg)" name="Predicted" strokeWidth={2} />
                    <Area type="monotone" dataKey="upper_bound" stroke="rgba(239,68,68,0.4)" fill="none" name="Upper" strokeDasharray="4 4" strokeWidth={1} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
