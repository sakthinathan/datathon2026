'use client';
import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';

const API_BASE = 'http://localhost:8000';
const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#38bdf8','#a855f7','#ec4899','#14b8a6','#f97316','#84cc16'];

async function fetchAuth(path: string) {
  const token = localStorage.getItem('scrb_token');
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', fontSize:12 }}>
      <div style={{ fontWeight:600, marginBottom:6, color:'var(--text-primary)' }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color:p.color, marginBottom:2 }}>{p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong></div>
      ))}
    </div>
  );
};

export default function SociologyPage() {
  const [demographic, setDemographic] = useState<any>({});
  const [genderCrime, setGenderCrime] = useState<any[]>([]);
  const [ageGroup, setAgeGroup] = useState<any[]>([]);
  const [ecoRisk, setEcoRisk] = useState<any[]>([]);
  const [repeatVsFirst, setRepeatVsFirst] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchAuth('/sociology/demographic-breakdown'),
      fetchAuth('/sociology/crime-by-gender'),
      fetchAuth('/sociology/crime-by-age-group'),
      fetchAuth('/sociology/economic-risk-zones'),
      fetchAuth('/sociology/repeat-vs-first-time'),
      fetchAuth('/sociology/social-risk-summary'),
    ]).then(([demo, gc, ag, er, rv, sum]) => {
      setDemographic(demo);
      setGenderCrime(gc);
      setAgeGroup(ag);
      setEcoRisk(er);
      setRepeatVsFirst(rv);
      setSummary(sum);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const STAT_CARDS = [
    { label: 'Total Suspects', value: summary.total_suspects?.toLocaleString(), icon: '👤', color: '#6366f1' },
    { label: 'Unemployed Suspects', value: `${summary.unemployed_count} (${summary.unemployed_pct}%)`, icon: '💼', color: '#f59e0b' },
    { label: 'High-Risk Youth (≤25)', value: `${summary.high_risk_youth} (${summary.high_risk_youth_pct}%)`, icon: '⚠️', color: '#ef4444' },
    { label: 'Habitual Offenders', value: summary.habitual_offenders?.toLocaleString(), icon: '🔄', color: '#a855f7' },
    { label: 'Gang Associates', value: summary.gang_associates?.toLocaleString(), icon: '🕸️', color: '#ec4899' },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title"><span className="page-icon">🧬</span>Sociological Crime Insights</div>
        <div style={{ fontSize:13, color:'var(--text-muted)' }}>Demographic & socio-economic patterns in crime data</div>
      </div>

      <div className="page-content">
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:80 }}>
            <div className="spinner" style={{ width:40, height:40 }} />
          </div>
        ) : (
          <>
            {/* Summary KPIs */}
            <div className="stats-grid" style={{ marginBottom:24 }}>
              {STAT_CARDS.map((s, i) => (
                <div key={i} className="stat-card fade-in" style={{ '--accent-color': s.color } as any}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value" style={{ color:s.color }}>{s.value ?? '—'}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Gender + Age Group */}
            <div className="chart-grid" style={{ marginBottom:20 }}>
              <div className="glass-card chart-container">
                <div className="chart-title">⚧ Gender Distribution of Suspects</div>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={demographic.gender || []} cx="50%" cy="50%" outerRadius={90}
                      dataKey="count" nameKey="gender"
                      label={(p: any) => `${p.gender}: ${p.count}`}
                      labelLine={{ stroke:'rgba(255,255,255,0.2)' }}>
                      {(demographic.gender || []).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card chart-container">
                <div className="chart-title">🎂 Risk Level by Age Group</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ageGroup}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="age_group" tick={{ fill:'#64748b', fontSize:12 }} />
                    <YAxis tick={{ fill:'#64748b', fontSize:12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="High" fill="#ef4444" name="High Risk" stackId="a" />
                    <Bar dataKey="Medium" fill="#f59e0b" name="Medium Risk" stackId="a" />
                    <Bar dataKey="Low" fill="#22c55e" name="Low Risk" stackId="a" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Crime by Gender + Occupation */}
            <div className="chart-grid" style={{ marginBottom:20 }}>
              <div className="glass-card chart-container">
                <div className="chart-title">🚨 Crime Type by Gender</div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={genderCrime.slice(0,10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={{ fill:'#64748b', fontSize:11 }} />
                    <YAxis dataKey="crime_type" type="category" tick={{ fill:'#94a3b8', fontSize:10 }} width={120} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="Male" fill="#6366f1" name="Male" stackId="a" />
                    <Bar dataKey="Female" fill="#ec4899" name="Female" stackId="a" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card chart-container">
                <div className="chart-title">💼 Top Occupations of Suspects</div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={(demographic.occupations || []).slice(0,10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={{ fill:'#64748b', fontSize:11 }} />
                    <YAxis dataKey="occupation" type="category" tick={{ fill:'#94a3b8', fontSize:11 }} width={130} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Suspects" radius={[0,4,4,0]}>
                      {(demographic.occupations || []).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Economic Risk Zones */}
            <div className="glass-card" style={{ padding:24, marginBottom:20 }}>
              <div className="chart-title">🏚️ Economic Vulnerability by District</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>
                Districts with highest proportion of unemployed / daily wage worker suspects
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>District</th>
                    <th>Total Suspects</th>
                    <th>Economically Vulnerable</th>
                    <th>Vulnerability %</th>
                    <th>Risk Indicator</th>
                  </tr>
                </thead>
                <tbody>
                  {ecoRisk.map((d: any, i: number) => (
                    <tr key={d.district}>
                      <td style={{ color:'var(--text-muted)' }}>{i+1}</td>
                      <td style={{ fontWeight:600 }}>{d.district}</td>
                      <td>{d.total?.toLocaleString()}</td>
                      <td style={{ color:'var(--warning)', fontWeight:600 }}>{d.vulnerable}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div className="progress-bar" style={{ width:80 }}>
                            <div className="progress-fill" style={{
                              width:`${d.vulnerability_pct}%`,
                              background: d.vulnerability_pct > 50 ? 'var(--danger)' : d.vulnerability_pct > 30 ? 'var(--warning)' : 'var(--success)'
                            }} />
                          </div>
                          <span style={{ fontSize:12, fontWeight:700 }}>{d.vulnerability_pct}%</span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize:10, padding:'2px 8px', borderRadius:99, fontWeight:700,
                          background: d.vulnerability_pct > 50 ? 'rgba(239,68,68,0.15)' : d.vulnerability_pct > 30 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                          color: d.vulnerability_pct > 50 ? 'var(--danger)' : d.vulnerability_pct > 30 ? 'var(--warning)' : 'var(--success)',
                          border: `1px solid ${d.vulnerability_pct > 50 ? 'rgba(239,68,68,0.3)' : d.vulnerability_pct > 30 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`
                        }}>
                          {d.vulnerability_pct > 50 ? '🔴 High' : d.vulnerability_pct > 30 ? '🟡 Medium' : '🟢 Low'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Repeat vs First-Time Chart */}
            <div className="glass-card chart-container" style={{ marginBottom:20 }}>
              <div className="chart-title">🔄 Repeat Offenders vs First-Time — by District</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={repeatVsFirst.slice(0,12)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="district" tick={{ fill:'#64748b', fontSize:10 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fill:'#64748b', fontSize:11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="repeat_offenders" fill="#ef4444" name="Repeat Offenders" stackId="a" />
                  <Bar dataKey="first_time" fill="#6366f1" name="First Time" stackId="a" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
