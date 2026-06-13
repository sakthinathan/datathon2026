'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#38bdf8','#a855f7','#ec4899','#14b8a6','#f97316','#84cc16'];
const CRIME_TYPES = ['All','Murder','Robbery','Theft','Cybercrime','Assault','Fraud','Drug Offense','Kidnapping','POCSO','Domestic Violence'];
const YEARS = [2018,2019,2020,2021,2022,2023,2024];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', fontSize:12 }}>
      <div style={{ fontWeight:600, marginBottom:6, color:'var(--text-primary)' }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color:p.color, marginBottom:2 }}>{p.name}: <strong>{p.value?.toLocaleString()}</strong></div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<any>({});
  const [yearlyTrends, setYearlyTrends] = useState<any[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<any[]>([]);
  const [districtData, setDistrictData] = useState<any[]>([]);
  const [crimeTypeData, setCrimeTypeData] = useState<any[]>([]);
  const [severityData, setSeverityData] = useState<any[]>([]);
  const [timeOfDay, setTimeOfDay] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [selectedCrime, setSelectedCrime] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getOverview(), api.getYearlyTrends(), api.getMonthlyTrends(),
      api.getByDistrict(), api.getByCrimeType(), api.getSeverityDist(),
      api.getTimeOfDay(), api.getStations()
    ]).then(([ov, yt, mt, dd, ct, sv, tod, st]) => {
      setOverview(ov); setYearlyTrends(yt); setMonthlyTrends(mt);
      setDistrictData(dd.slice(0,15)); setCrimeTypeData(ct.slice(0,12));
      setSeverityData(sv); setTimeOfDay(tod); setStations(st.slice(0,10));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const refreshFiltered = async () => {
    const [dd, ct, mt] = await Promise.all([
      api.getByDistrict(selectedYear || undefined, selectedCrime !== 'All' ? selectedCrime : undefined),
      api.getByCrimeType(selectedYear || undefined),
      api.getMonthlyTrends(selectedYear || undefined),
    ]);
    setDistrictData(dd.slice(0,15)); setCrimeTypeData(ct.slice(0,12)); setMonthlyTrends(mt);
  };
  useEffect(() => { if (!loading) refreshFiltered(); }, [selectedYear, selectedCrime]);

  const STAT_CARDS = [
    { label:'Total Crimes', value: overview.total_crimes?.toLocaleString(), icon:'🚨', color:'#ef4444', accent:'rgba(239,68,68,0.2)' },
    { label:'Police Stations', value: overview.total_stations?.toLocaleString(), icon:'🚓', color:'#6366f1', accent:'rgba(99,102,241,0.2)' },
    { label:'Case Solve Rate', value: `${overview.solve_rate}%`, icon:'✅', color:'#22c55e', accent:'rgba(34,197,94,0.2)' },
    { label:'Pending Cases', value: overview.pending_investigation?.toLocaleString(), icon:'⏳', color:'#f59e0b', accent:'rgba(245,158,11,0.2)' },
    { label:'Critical Cases', value: overview.critical_cases?.toLocaleString(), icon:'🔴', color:'#ef4444', accent:'rgba(239,68,68,0.15)' },
    { label:'2024 Crimes', value: overview.recent_year_crimes?.toLocaleString(), icon:'📅', color:'#38bdf8', accent:'rgba(56,189,248,0.15)' },
  ];

  const severityColors: any = { Critical:'#ef4444', High:'#f59e0b', Medium:'#6366f1', Low:'#22c55e' };

  return (
    <div>
      <div className="page-header">
        <div className="page-title"><span className="page-icon">📊</span>Crime Analytics</div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <select className="filter-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            <option value={0}>All Years</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="filter-select" value={selectedCrime} onChange={e => setSelectedCrime(e.target.value)}>
            {CRIME_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="page-content">
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:80 }}><div className="spinner" style={{ width:40,height:40 }} /></div>
        ) : (
          <>
            {/* Stats */}
            <div className="stats-grid">
              {STAT_CARDS.map((s,i) => (
                <div key={i} className="stat-card fade-in" style={{ '--accent-color': s.color } as any}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value" style={{ color:s.color }}>{s.value ?? '—'}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Year Trend + Monthly */}
            <div className="chart-grid" style={{ marginBottom:20 }}>
              <div className="glass-card chart-container">
                <div className="chart-title">📈 Year-over-Year Crime Trends</div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={yearlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="year" tick={{ fill:'#64748b', fontSize:12 }} />
                    <YAxis tick={{ fill:'#64748b', fontSize:12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={{ fill:'#6366f1', r:4 }} name="Total Crimes" />
                    <Line type="monotone" dataKey="solved" stroke="#22c55e" strokeWidth={2} dot={{ fill:'#22c55e', r:4 }} name="Solved" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card chart-container">
                <div className="chart-title">📅 Monthly Pattern</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill:'#64748b', fontSize:11 }} />
                    <YAxis tick={{ fill:'#64748b', fontSize:11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" fill="#6366f1" name="Crimes" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Crime Types + Severity */}
            <div className="chart-grid" style={{ marginBottom:20 }}>
              <div className="glass-card chart-container">
                <div className="chart-title">🗂️ Crime Type Distribution</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={crimeTypeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={{ fill:'#64748b', fontSize:11 }} />
                    <YAxis dataKey="crime_type" type="category" tick={{ fill:'#94a3b8', fontSize:11 }} width={130} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Cases" radius={[0,4,4,0]}>
                      {crimeTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card chart-container">
                <div className="chart-title">⚠️ Severity Distribution</div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={severityData} cx="50%" cy="50%" outerRadius={100} dataKey="total" nameKey="severity"
                      label={(props: any) => `${props.severity || props.name} ${((props.percent || 0)*100).toFixed(0)}%`}
                      labelLine={{ stroke:'rgba(255,255,255,0.2)' }}>
                      {severityData.map((entry: any, i) => <Cell key={i} fill={severityColors[entry.severity] || COLORS[i]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* District Bar + Time Heatmap */}
            <div className="chart-grid" style={{ marginBottom:20 }}>
              <div className="glass-card chart-container">
                <div className="chart-title">🗺️ Top Districts by Crime Count</div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={districtData.slice(0,12)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="district" tick={{ fill:'#64748b', fontSize:10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fill:'#64748b', fontSize:11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Total" radius={[4,4,0,0]}>
                      {districtData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card chart-container">
                <div className="chart-title">🕐 Time-of-Day Crime Pattern</div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={timeOfDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="hour" tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={(v) => `${v}:00`} />
                    <YAxis tick={{ fill:'#64748b', fontSize:11 }} />
                    <Tooltip content={<CustomTooltip />} labelFormatter={(v) => `${v}:00 hrs`} />
                    <Bar dataKey="total" name="Crimes" fill="#f59e0b" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Police Stations Table */}
            <div className="glass-card" style={{ padding:24, marginBottom:20 }}>
              <div className="chart-title">🚓 Top Police Stations — Solve Rate</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>Station</th><th>District</th>
                    <th>Cases Filed</th><th>Cases Solved</th><th>Solve Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {stations.map((s: any, i: number) => (
                    <tr key={s.id}>
                      <td style={{ color:'var(--text-muted)' }}>{i+1}</td>
                      <td style={{ fontWeight:500 }}>{s.name}</td>
                      <td><span style={{ fontSize:12, color:'var(--accent-light)' }}>{s.district}</span></td>
                      <td>{s.cases_filed?.toLocaleString()}</td>
                      <td>{s.cases_solved?.toLocaleString()}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div className="progress-bar" style={{ width:80 }}>
                            <div className="progress-fill" style={{ width:`${s.solve_rate}%`, background: s.solve_rate > 70 ? 'var(--success)' : s.solve_rate > 50 ? 'var(--warning)' : 'var(--danger)' }} />
                          </div>
                          <span style={{ fontSize:12, fontWeight:600 }}>{s.solve_rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
