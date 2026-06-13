'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getUser } from '@/lib/api';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
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
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px', fontSize:12 }}>
      <div style={{ fontWeight:600, marginBottom:4, color:'var(--text-primary)' }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color:p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// Animated counter hook
function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return val;
}

function StatCard({ label, value, icon, color, sub, href }: any) {
  const num = typeof value === 'number' ? value : 0;
  const animated = useCountUp(num);
  const display = typeof value === 'string' ? value : animated.toLocaleString();
  return (
    <Link href={href || '#'} style={{ textDecoration:'none' }}>
      <div className="stat-card fade-in" style={{ '--accent-color': color, cursor:'pointer' } as any}>
        <div className="stat-icon">{icon}</div>
        <div className="stat-value" style={{ color }}>{display}</div>
        <div className="stat-label">{label}</div>
        {sub && <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>{sub}</div>}
      </div>
    </Link>
  );
}

const QUICK_LINKS = [
  { href:'/dashboard/chat', icon:'🤖', label:'AI Investigator', desc:'Ask crime questions in natural language', color:'#6366f1' },
  { href:'/dashboard/investigator', icon:'🔎', label:'Case Intelligence', desc:'Search FIRs, get AI summaries & leads', color:'#22c55e' },
  { href:'/dashboard/network', icon:'🕸️', label:'Criminal Network', desc:'Visualize gang links and associations', color:'#f59e0b' },
  { href:'/dashboard/financial', icon:'💸', label:'Financial Crimes', desc:'Track suspicious transactions & money trail', color:'#ef4444' },
  { href:'/dashboard/sociology', icon:'🧬', label:'Sociological Insights', desc:'Demographic & economic crime patterns', color:'#a855f7' },
  { href:'/dashboard/predictions', icon:'🔮', label:'Predictive Alerts', desc:'Early warnings & crime forecasts', color:'#ec4899' },
  { href:'/dashboard/offenders', icon:'🕵️', label:'Offender Profiling', desc:'High-risk suspects & behavioral tags', color:'#38bdf8' },
  { href:'/dashboard/analytics', icon:'📊', label:'Analytics', desc:'Full crime analytics dashboard', color:'#14b8a6' },
];

export default function DashboardHome() {
  const router = useRouter();
  const user = getUser();
  const [overview, setOverview] = useState<any>({});
  const [yearlyTrends, setYearlyTrends] = useState<any[]>([]);
  const [crimeTypes, setCrimeTypes] = useState<any[]>([]);
  const [severity, setSeverity] = useState<any[]>([]);
  const [hotspots, setHotspots] = useState<any[]>([]);
  const [earlyWarnings, setEarlyWarnings] = useState<any[]>([]);
  const [recentOffenders, setRecentOffenders] = useState<any[]>([]);
  const [financialSummary, setFinancialSummary] = useState<any>({});
  const [predSummary, setPredSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [now] = useState(new Date());

  useEffect(() => {
    const token = localStorage.getItem('scrb_token');
    if (!token) { router.replace('/login'); return; }

    Promise.all([
      api.getOverview(),
      api.getYearlyTrends(),
      api.getByCrimeType(),
      api.getSeverityDist(),
      api.getHotspots(),
      fetchAuth('/predictions/early-warnings'),
      fetchAuth('/offenders/repeat-offenders?risk_level=High'),
      fetchAuth('/financial/summary'),
      api.getPredictionSummary(),
    ]).then(([ov, yt, ct, sv, hs, ew, off, fin, ps]) => {
      setOverview(ov);
      setYearlyTrends(yt);
      setCrimeTypes(ct.slice(0, 6));
      setSeverity(sv);
      setHotspots(hs.slice(0, 6));
      setEarlyWarnings(ew.slice(0, 4));
      setRecentOffenders(off.slice(0, 5));
      setFinancialSummary(fin);
      setPredSummary(ps);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const sevColors: any = { Critical:'#ef4444', High:'#f59e0b', Medium:'#6366f1', Low:'#22c55e' };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:16 }}>
      <div className="spinner" style={{ width:48, height:48, borderWidth:3 }} />
      <div style={{ color:'var(--text-muted)', fontSize:14 }}>Loading Command Center...</div>
    </div>
  );

  return (
    <div>
      {/* Hero Header */}
      <div className="page-header" style={{ background:'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.08) 100%)', borderBottom:'1px solid rgba(99,102,241,0.2)', marginBottom:0 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <div style={{ fontSize:28 }}>🚔</div>
            <div>
              <div style={{ fontWeight:900, fontSize:22, letterSpacing:'-0.5px' }}>
                SCRB CrimeIntel
                <span style={{ fontSize:12, fontWeight:500, color:'var(--accent-light)', marginLeft:10, padding:'2px 10px', background:'rgba(99,102,241,0.15)', borderRadius:99, border:'1px solid rgba(99,102,241,0.3)' }}>
                  Command Center
                </span>
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                Karnataka State Crime Records Bureau · {now.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
              </div>
            </div>
          </div>
          <div style={{ fontSize:13, color:'var(--text-secondary)' }}>
            Welcome back, <strong style={{ color:'var(--accent-light)' }}>{user?.full_name?.split(' ')[0] || 'Officer'}</strong> · 
            <span style={{ marginLeft:6, padding:'1px 8px', borderRadius:99, background:'rgba(34,197,94,0.1)', color:'var(--success)', fontSize:11, fontWeight:600, border:'1px solid rgba(34,197,94,0.2)' }}>
              ● Live
            </span>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Link href="/dashboard/chat" className="btn btn-primary">🤖 Ask AI</Link>
          <Link href="/dashboard/predictions" className="btn btn-ghost">🔮 Predictions</Link>
        </div>
      </div>

      <div className="page-content">

        {/* KPI Strip */}
        <div className="stats-grid" style={{ marginBottom:24 }}>
          <StatCard label="Total Crime Records" value={overview.total_crimes} icon="🚨" color="#ef4444" sub="Across 31 districts" href="/dashboard/analytics" />
          <StatCard label="Police Stations" value={overview.total_stations} icon="🚓" color="#6366f1" sub="State-wide coverage" href="/dashboard/analytics" />
          <StatCard label="Case Solve Rate" value={`${overview.solve_rate}%`} icon="✅" color="#22c55e" sub="Cases closed" href="/dashboard/analytics" />
          <StatCard label="Pending Investigations" value={overview.pending_investigation} icon="⏳" color="#f59e0b" sub="Active cases" href="/dashboard/analytics" />
          <StatCard label="Critical Alerts" value={predSummary.critical} icon="🔴" color="#ef4444" sub="High-priority threats" href="/dashboard/predictions" />
          <StatCard label="Suspicious Transactions" value={financialSummary.suspicious_transactions} icon="💸" color="#a855f7" sub="Financial crime flags" href="/dashboard/financial" />
        </div>

        {/* Early Warning Banner */}
        {earlyWarnings.length > 0 && (
          <div style={{ marginBottom:24, background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:16, padding:'16px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--danger)', boxShadow:'0 0 12px rgba(239,68,68,0.8)' }} />
              <div style={{ fontWeight:700, fontSize:14, color:'var(--danger)' }}>⚡ Active Early Warnings</div>
              <Link href="/dashboard/predictions" style={{ marginLeft:'auto', fontSize:12, color:'var(--accent-light)', textDecoration:'none' }}>View all →</Link>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10 }}>
              {earlyWarnings.map((w: any) => (
                <div key={w.id} style={{
                  background: w.urgency === 'IMMEDIATE' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                  border: `1px solid ${w.urgency === 'IMMEDIATE' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
                  borderRadius:10, padding:'10px 12px'
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <div style={{ fontWeight:700, fontSize:12 }}>{w.district}</div>
                    <span style={{ fontSize:9, padding:'1px 6px', borderRadius:99, fontWeight:800, background: w.urgency==='IMMEDIATE'?'rgba(239,68,68,0.2)':'rgba(245,158,11,0.2)', color: w.urgency==='IMMEDIATE'?'var(--danger)':'var(--warning)' }}>{w.urgency}</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:6 }}>{w.crime_type}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>📈 {w.predicted_count} predicted · {Math.round(w.confidence*100)}% confidence</div>
                  <div style={{ fontSize:10, color:'var(--accent-light)', marginTop:6, borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:6 }}>→ {w.recommended_action?.slice(0,55)}…</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Charts Row */}
        <div className="chart-grid" style={{ marginBottom:24 }}>
          {/* Yearly Trend */}
          <div className="glass-card chart-container">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div className="chart-title" style={{ marginBottom:0 }}>📈 Crime Trend 2018–2024</div>
              <Link href="/dashboard/analytics" style={{ fontSize:11, color:'var(--accent-light)', textDecoration:'none' }}>Full analytics →</Link>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={yearlyTrends}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" tick={{ fill:'#64748b', fontSize:11 }} />
                <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#colorTotal)" name="Total Crimes" strokeWidth={2} />
                <Area type="monotone" dataKey="solved" stroke="#22c55e" fill="url(#colorSolved)" name="Solved" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top Crime Types */}
          <div className="glass-card chart-container">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div className="chart-title" style={{ marginBottom:0 }}>🗂️ Top Crime Types</div>
              <Link href="/dashboard/analytics" style={{ fontSize:11, color:'var(--accent-light)', textDecoration:'none' }}>Details →</Link>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={crimeTypes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill:'#64748b', fontSize:10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <YAxis dataKey="crime_type" type="category" tick={{ fill:'#94a3b8', fontSize:10 }} width={110} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Cases" radius={[0,4,4,0]}>
                  {crimeTypes.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Second Row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:20, marginBottom:24 }}>
          {/* Severity Donut */}
          <div className="glass-card chart-container">
            <div className="chart-title">⚠️ Severity Breakdown</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={severity} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                  dataKey="total" nameKey="severity"
                  label={(p: any) => `${p.severity?.slice(0,4)} ${((p.percent||0)*100).toFixed(0)}%`}
                  labelLine={{ stroke:'rgba(255,255,255,0.15)' }}>
                  {severity.map((e: any, i: number) => <Cell key={i} fill={sevColors[e.severity] || COLORS[i]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Hotspots */}
          <div className="glass-card chart-container">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div className="chart-title" style={{ marginBottom:0 }}>🔥 Crime Hotspots</div>
              <Link href="/dashboard/predictions" style={{ fontSize:11, color:'var(--accent-light)', textDecoration:'none' }}>All →</Link>
            </div>
            {hotspots.map((h: any, i: number) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ width:20, textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>{i+1}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                    <span style={{ fontWeight:600 }}>{h.district}</span>
                    <span style={{ color: h.severity==='Critical'?'var(--danger)':'var(--warning)', fontWeight:700, fontSize:11 }}>{h.predicted_count}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width:`${Math.min((h.predicted_count/200)*100, 100)}%`, background: h.severity==='Critical'?'var(--danger)':'var(--warning)' }} />
                  </div>
                </div>
                <span style={{ fontSize:9, padding:'1px 5px', borderRadius:99, fontWeight:700, background: h.severity==='Critical'?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)', color:h.severity==='Critical'?'var(--danger)':'var(--warning)' }}>{h.severity}</span>
              </div>
            ))}
          </div>

          {/* High-Risk Offenders */}
          <div className="glass-card" style={{ padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div className="chart-title" style={{ marginBottom:0 }}>🕵️ High-Risk Suspects</div>
              <Link href="/dashboard/offenders" style={{ fontSize:11, color:'var(--accent-light)', textDecoration:'none' }}>All →</Link>
            </div>
            {recentOffenders.map((o: any, i: number) => (
              <div key={o.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom: i < recentOffenders.length-1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg, #ef4444, rgba(239,68,68,0.3))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>🕵️</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.name}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{o.district} · {o.crime_count} crimes</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'var(--danger)' }}>{o.risk_score}</div>
                  <div className="progress-bar" style={{ width:40 }}>
                    <div className="progress-fill" style={{ width:`${o.risk_score}%`, background:'var(--danger)' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Access Modules */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14, color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:8 }}>
            <span>🧭</span> Quick Access — All Modules
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14 }}>
            {QUICK_LINKS.map(q => (
              <Link key={q.href} href={q.href} style={{ textDecoration:'none' }}>
                <div className="glass-card fade-in" style={{ padding:'16px 18px', cursor:'pointer', transition:'all 0.2s', border:`1px solid ${q.color}22` }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                  <div style={{ fontSize:26, marginBottom:8 }}>{q.icon}</div>
                  <div style={{ fontWeight:700, fontSize:13, color: q.color, marginBottom:4 }}>{q.label}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.4 }}>{q.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Financial + Recent Activity Row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {/* Financial Summary */}
          <div className="glass-card" style={{ padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div className="chart-title" style={{ marginBottom:0 }}>💸 Financial Crime Summary</div>
              <Link href="/dashboard/financial" style={{ fontSize:11, color:'var(--accent-light)', textDecoration:'none' }}>Full module →</Link>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                { label:'Total Accounts', value: financialSummary.total_accounts?.toLocaleString(), icon:'🏦', color:'#6366f1' },
                { label:'Flagged Accounts', value: financialSummary.flagged_accounts?.toLocaleString(), icon:'🚩', color:'#ef4444' },
                { label:'Total Transactions', value: financialSummary.total_transactions?.toLocaleString(), icon:'💳', color:'#38bdf8' },
                { label:'Suspicious Txns', value: financialSummary.suspicious_transactions?.toLocaleString(), icon:'⚠️', color:'#f59e0b' },
              ].map((s, i) => (
                <div key={i} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'12px 14px', border:`1px solid ${s.color}22` }}>
                  <div style={{ fontSize:20, marginBottom:6 }}>{s.icon}</div>
                  <div style={{ fontWeight:800, fontSize:18, color:s.color }}>{s.value ?? '—'}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {financialSummary.suspicious_amount > 0 && (
              <div style={{ marginTop:14, padding:'10px 14px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:16 }}>💰</span>
                <div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>Total Suspicious Transaction Value</div>
                  <div style={{ fontWeight:800, color:'var(--danger)', fontSize:16 }}>
                    ₹{(financialSummary.suspicious_amount / 100000).toFixed(1)}L
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Prediction Summary */}
          <div className="glass-card" style={{ padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div className="chart-title" style={{ marginBottom:0 }}>🔮 Prediction Intelligence</div>
              <Link href="/dashboard/predictions" style={{ fontSize:11, color:'var(--accent-light)', textDecoration:'none' }}>Full module →</Link>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              {[
                { label:'Total Alerts', value: predSummary.total_alerts, icon:'🔔', color:'#6366f1' },
                { label:'Critical', value: predSummary.critical, icon:'🔴', color:'#ef4444' },
                { label:'Warning', value: predSummary.warning, icon:'🟡', color:'#f59e0b' },
                { label:'Rising Trend', value: predSummary.rising_trend, icon:'📈', color:'#ec4899' },
              ].map((s, i) => (
                <div key={i} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'12px 14px', border:`1px solid ${s.color}22` }}>
                  <div style={{ fontSize:20, marginBottom:6 }}>{s.icon}</div>
                  <div style={{ fontWeight:800, fontSize:18, color:s.color }}>{s.value ?? '—'}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <Link href="/dashboard/predictions" className="btn btn-primary" style={{ flex:1, textAlign:'center', textDecoration:'none', fontSize:12 }}>
                ⚡ View Early Warnings
              </Link>
              <Link href="/dashboard/chat" className="btn btn-ghost" style={{ flex:1, textAlign:'center', textDecoration:'none', fontSize:12 }}>
                🤖 Ask AI
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
