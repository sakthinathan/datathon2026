'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Cell } from 'recharts';

const API_BASE = 'http://localhost:8000';

async function getOffenders(params = '') {
  const token = localStorage.getItem('scrb_token');
  const res = await fetch(`${API_BASE}/offenders/repeat-offenders${params}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}
async function getDistrictProfile() {
  const token = localStorage.getItem('scrb_token');
  const res = await fetch(`${API_BASE}/offenders/district-profile`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

const DISTRICTS = ['All','Bengaluru Urban','Mysuru','Hubballi-Dharwad','Mangaluru','Belagavi','Kalaburagi','Ballari','Vijayapura','Shivamogga','Tumakuru'];
const TAG_COLORS: Record<string,string> = {
  'Habitual Offender': 'var(--danger)',
  'Repeat Offender': 'var(--warning)',
  'High Surveillance': 'rgba(239,68,68,0.6)',
  'Economically Vulnerable': 'rgba(245,158,11,0.6)',
  'Gang Associate': '#a855f7',
};

export default function OffendersPage() {
  const [offenders, setOffenders] = useState<any[]>([]);
  const [districtProfile, setDistrictProfile] = useState<any[]>([]);
  const [selectedOffender, setSelectedOffender] = useState<any>(null);
  const [district, setDistrict] = useState('All');
  const [riskLevel, setRiskLevel] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (district !== 'All') params.set('district', district);
    if (riskLevel !== 'All') params.set('risk_level', riskLevel);
    const q = params.toString() ? `?${params}` : '';
    Promise.all([getOffenders(q), getDistrictProfile()]).then(([off, dp]) => {
      setOffenders(off); setDistrictProfile(dp); setLoading(false);
    }).catch(() => setLoading(false));
  }, [district, riskLevel]);

  const highRisk = offenders.filter(o => o.risk_level === 'High').length;
  const habitual = offenders.filter(o => o.crime_count > 6).length;

  const radarData = selectedOffender ? [
    { subject: 'Crime Count', A: Math.min(selectedOffender.crime_count * 10, 100) },
    { subject: 'Network Size', A: Math.min(selectedOffender.network_size * 8, 100) },
    { subject: 'Risk Score', A: selectedOffender.risk_score },
    { subject: 'Recidivism', A: selectedOffender.crime_count > 3 ? 80 : 40 },
    { subject: 'Threat Level', A: selectedOffender.risk_level === 'High' ? 90 : selectedOffender.risk_level === 'Medium' ? 55 : 25 },
  ] : [];

  return (
    <div>
      <div className="page-header">
        <div className="page-title"><span className="page-icon">🕵️</span>Offender Profiling</div>
        <div style={{ display:'flex', gap:10 }}>
          <select className="filter-select" value={district} onChange={e => setDistrict(e.target.value)}>
            {DISTRICTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select className="filter-select" value={riskLevel} onChange={e => setRiskLevel(e.target.value)}>
            <option>All</option><option>High</option><option>Medium</option><option>Low</option>
          </select>
        </div>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom:24 }}>
          {[
            { label:'Total Profiled', value: offenders.length, icon:'🕵️', color:'var(--accent)' },
            { label:'High Risk', value: highRisk, icon:'🔴', color:'var(--danger)' },
            { label:'Habitual Offenders', value: habitual, icon:'⚠️', color:'var(--warning)' },
            { label:'Avg Risk Score', value: offenders.length ? Math.round(offenders.reduce((a,o) => a+o.risk_score,0)/offenders.length) : 0, icon:'📊', color:'var(--info)' },
          ].map((s,i) => (
            <div key={i} className="stat-card" style={{ '--accent-color': s.color } as any}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
          {/* Offender Table */}
          <div>
            <div className="glass-card" style={{ padding:'20px 0', marginBottom:20 }}>
              <div style={{ padding:'0 20px 16px', borderBottom:'1px solid var(--border)' }}>
                <div className="chart-title" style={{ marginBottom:0 }}>⚠️ Repeat & High-Risk Offenders</div>
              </div>
              {loading ? (
                <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner" /></div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>Name</th><th>Alias</th><th>District</th><th>Crimes</th><th>Network</th><th>Risk Score</th><th>Tags</th></tr>
                  </thead>
                  <tbody>
                    {offenders.map((o: any, i: number) => (
                      <tr key={o.id} style={{ cursor:'pointer' }} onClick={() => setSelectedOffender(o)}>
                        <td style={{ color:'var(--text-muted)' }}>{i+1}</td>
                        <td><span style={{ fontWeight:600, color: o.id === selectedOffender?.id ? 'var(--accent-light)' : 'var(--text-primary)' }}>{o.name}</span></td>
                        <td><code style={{ fontSize:11, color:'#a5f3fc', background:'rgba(0,0,0,0.3)', padding:'2px 6px', borderRadius:4 }}>{o.alias}</code></td>
                        <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{o.district}</td>
                        <td><span style={{ fontWeight:700, color: o.crime_count > 5 ? 'var(--danger)' : 'var(--text-primary)' }}>{o.crime_count}</span></td>
                        <td><span style={{ fontWeight:700, color:'var(--accent-light)' }}>{o.network_size}</span></td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div className="progress-bar" style={{ width:60 }}>
                              <div className="progress-fill" style={{ width:`${o.risk_score}%`, background: o.risk_score > 70 ? 'var(--danger)' : o.risk_score > 40 ? 'var(--warning)' : 'var(--success)' }} />
                            </div>
                            <span style={{ fontSize:12, fontWeight:700 }}>{o.risk_score}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                            {o.behavioral_tags?.map((tag: string) => (
                              <span key={tag} style={{ fontSize:9, padding:'2px 6px', borderRadius:99, background:TAG_COLORS[tag] || 'var(--bg-glass)', color:'white', fontWeight:600, whiteSpace:'nowrap' }}>{tag}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* District Risk Profile Chart */}
            <div className="glass-card chart-container">
              <div className="chart-title">🗺️ District-wise Risk Distribution</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={districtProfile.slice(0,10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="district" tick={{ fill:'#64748b', fontSize:10 }} angle={-25} textAnchor="end" height={55} />
                  <YAxis tick={{ fill:'#64748b', fontSize:11 }} />
                  <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, fontSize:12 }} />
                  <Bar dataKey="High" fill="#ef4444" name="High Risk" stackId="a" radius={[0,0,0,0]} />
                  <Bar dataKey="Medium" fill="#f59e0b" name="Medium Risk" stackId="a" />
                  <Bar dataKey="Low" fill="#22c55e" name="Low Risk" stackId="a" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Selected Offender Profile */}
          <div>
            {selectedOffender ? (
              <div className="glass-card" style={{ padding:24, position:'sticky', top:80 }}>
                <div style={{ textAlign:'center', marginBottom:20 }}>
                  <div style={{ width:64, height:64, borderRadius:20, background:`linear-gradient(135deg, ${selectedOffender.risk_level==='High'?'#ef4444':selectedOffender.risk_level==='Medium'?'#f59e0b':'#22c55e'}, rgba(0,0,0,0.4))`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, margin:'0 auto 12px' }}>🕵️</div>
                  <div style={{ fontWeight:800, fontSize:18 }}>{selectedOffender.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>{selectedOffender.alias}</div>
                  <span className={`badge badge-${selectedOffender.risk_level.toLowerCase()}`}>{selectedOffender.risk_level} Risk</span>
                </div>

                {[
                  ['Age', selectedOffender.age],
                  ['Gender', selectedOffender.gender],
                  ['District', selectedOffender.district],
                  ['Occupation', selectedOffender.occupation],
                  ['Total Crimes', selectedOffender.crime_count],
                  ['Network Size', `${selectedOffender.network_size} associates`],
                ].map(([k,v]) => (
                  <div key={String(k)} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:13 }}>
                    <span style={{ color:'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontWeight:600 }}>{v}</span>
                  </div>
                ))}

                <div style={{ margin:'16px 0 8px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-muted)' }}>Behavioral Tags</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
                  {selectedOffender.behavioral_tags?.length > 0 ? selectedOffender.behavioral_tags.map((tag: string) => (
                    <span key={tag} style={{ fontSize:10, padding:'3px 8px', borderRadius:99, background:TAG_COLORS[tag]||'var(--bg-glass)', color:'white', fontWeight:700 }}>{tag}</span>
                  )) : <span style={{ fontSize:12, color:'var(--text-muted)' }}>No tags</span>}
                </div>

                {/* Radar Chart */}
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:8 }}>Risk Profile</div>
                <ResponsiveContainer width="100%" height={180}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill:'#64748b', fontSize:10 }} />
                    <Radar dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="glass-card" style={{ padding:40, textAlign:'center' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🕵️</div>
                <div style={{ color:'var(--text-muted)', fontSize:14 }}>Click an offender to view full profile</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
