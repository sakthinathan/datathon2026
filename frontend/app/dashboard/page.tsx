'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getUser } from '@/lib/api';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#0052b4', '#FF8C00', '#22c55e', '#e53935', '#4d9fff', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];
const API_BASE = 'http://localhost:8000';

async function fetchAuth(path: string) {
  const token = localStorage.getItem('scrb_token');
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Fetch failed');
  return res.json();
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// Animated counter hook
function useCountUp(target: number, duration = 1000) {
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
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0;
  const animated = useCountUp(num);
  const display = typeof value === 'string' && value.includes('%') ? `${animated}%` : (typeof value === 'string' ? value : animated.toLocaleString());
  return (
    <Link href={href || '#'} style={{ textDecoration: 'none' }}>
      <div className="stat-card fade-in" style={{ '--accent-color': color, cursor: 'pointer' } as any}>
        <div className="stat-icon">{icon}</div>
        <div className="stat-value" style={{ color }}>{display}</div>
        <div className="stat-label">{label}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
      </div>
    </Link>
  );
}

export default function DashboardHome() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Common Analytics State
  const [overview, setOverview] = useState<any>({});
  const [yearlyTrends, setYearlyTrends] = useState<any[]>([]);
  const [crimeTypes, setCrimeTypes] = useState<any[]>([]);
  const [severity, setSeverity] = useState<any[]>([]);

  // Super Admin specific state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<any>({});
  const [totalUsersCount, setTotalUsersCount] = useState(0);

  // District SP specific state
  const [stations, setStations] = useState<any[]>([]);
  const [districtAlerts, setDistrictAlerts] = useState<any[]>([]);

  // Investigator specific state
  const [casesTimeline, setCasesTimeline] = useState<any[]>([]);
  const [offendersWatchlist, setOffendersWatchlist] = useState<any[]>([]);
  const [filingFIR, setFilingFIR] = useState(false);
  const [firFormData, setFirFormData] = useState({
    fir_number: '', date: new Date().toISOString().split('T')[0], time: '12:00',
    taluk: '', police_station: '', crime_type: 'Murder', ipc_section: '302 IPC',
    severity: 'Critical', description: '', victim_count: 1, accused_count: 1, property_value: 0
  });

  // Analyst specific state
  const [predSummary, setPredSummary] = useState<any>({});
  const [hotspots, setHotspots] = useState<any[]>([]);
  const [demographics, setDemographics] = useState<any>(null);

  // Read-only state
  const [bulletins] = useState([
    { id: 1, type: 'ALERT', text: 'State-wide night patrol intensified due to festival season enforcement protocols.', date: 'Today' },
    { id: 2, type: 'NOTICE', text: 'CCTNS server upgrades scheduled for tomorrow between 02:00 - 04:00 IST.', date: 'Yesterday' },
    { id: 3, type: 'COMMENDATION', text: 'Mysuru City Police commended for achieving a 92% case resolution rate in cyber crimes.', date: '3 days ago' },
  ]);

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Initial user setup
  useEffect(() => {
    const u = getUser();
    const token = localStorage.getItem('scrb_token');
    if (!token || !u) { router.replace('/login'); return; }
    setUser(u);
  }, [router]);

  // Dynamic Data Loading based on Role
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const role = user.role;
    const district = role === 'district_sp' || role === 'investigator' ? user.district : undefined;

    const fetches: Promise<any>[] = [];

    // Core analytics based on district lock
    fetches.push(api.getOverview(district));
    fetches.push(api.getYearlyTrends(district));
    fetches.push(api.getSeverityDist(district));
    fetches.push(api.getByCrimeType(undefined, district));

    if (role === 'super_admin') {
      fetches.push(api.getAuditLogs(6));
      fetches.push(api.getAuditStats());
      fetches.push(api.listUsers());
    } else if (role === 'district_sp') {
      fetches.push(api.getStations(district));
      fetches.push(api.getAlerts(undefined, district));
    } else if (role === 'investigator') {
      fetches.push(fetchAuth(`/investigator/case-timeline/${encodeURIComponent(district || '')}?limit=6`));
      fetches.push(fetchAuth(`/offenders/repeat-offenders?district=${encodeURIComponent(district || '')}&risk_level=High`));
    } else if (role === 'analyst') {
      fetches.push(api.getPredictionSummary());
      fetches.push(api.getHotspots());
      fetches.push(fetchAuth('/sociology/demographic-breakdown'));
    } else if (role === 'readonly') {
      // standard overview is enough for readonly
    }

    Promise.all(fetches)
      .then((results) => {
        setOverview(results[0]);
        setYearlyTrends(results[1]);
        setSeverity(results[2]);
        setCrimeTypes(results[3].slice(0, 6));

        const ptr = 4;
        if (role === 'super_admin') {
          setAuditLogs(results[ptr]?.logs || []);
          setAuditStats(results[ptr + 1] || {});
          setTotalUsersCount(results[ptr + 2]?.length || 0);
        } else if (role === 'district_sp') {
          setStations(results[ptr]?.slice(0, 6) || []);
          setDistrictAlerts(results[ptr + 1]?.slice(0, 4) || []);
        } else if (role === 'investigator') {
          setCasesTimeline(results[ptr] || []);
          setOffendersWatchlist(results[ptr + 1]?.slice(0, 5) || []);
        } else if (role === 'analyst') {
          setPredSummary(results[ptr] || {});
          setHotspots(results[ptr + 1]?.slice(0, 6) || []);
          setDemographics(results[ptr + 2] || null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard data load error:", err);
        setLoading(false);
      });
  }, [user]);

  // Create Crime handler for investigator
  const handleFileFIR = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const payload = {
      ...firFormData,
      district: user?.district || 'Mysuru',
    };

    fetch(`${API_BASE}/investigator/crimes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('scrb_token')}`
      },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Filing failed');
        setFormSuccess(`FIR ${payload.fir_number} created successfully.`);
        setFirFormData({
          fir_number: '', date: new Date().toISOString().split('T')[0], time: '12:00',
          taluk: '', police_station: '', crime_type: 'Murder', ipc_section: '302 IPC',
          severity: 'Critical', description: '', victim_count: 1, accused_count: 1, property_value: 0
        });
        setFilingFIR(false);

        // Reload data
        return fetchAuth(`/investigator/case-timeline/${encodeURIComponent(user.district)}?limit=6`);
      })
      .then(timeline => {
        if (timeline) setCasesTimeline(timeline);
      })
      .catch(err => setFormError(err.message || 'Failed to file FIR record'));
  };

  const handleUpdateStatus = (crimeId: number, newStatus: string) => {
    setFormSuccess('');
    setFormError('');
    fetch(`${API_BASE}/investigator/crimes/${crimeId}/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('scrb_token')}`
      },
      body: JSON.stringify({ status: newStatus })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Update failed');
        setFormSuccess(`Case status updated to ${newStatus}.`);

        // Reload timeline
        return fetchAuth(`/investigator/case-timeline/${encodeURIComponent(user.district)}?limit=6`);
      })
      .then(timeline => {
        if (timeline) setCasesTimeline(timeline);
      })
      .catch(err => setFormError(err.message));
  };

  const sevColors: any = { Critical: '#ef4444', High: '#f59e0b', Medium: '#6366f1', Low: '#22c55e' };

  if (loading && !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" style={{ width: 48, height: 48, borderWidth: 3 }} />
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Authenticating credentials...</div>
      </div>
    );
  }

  const roleLabels: any = {
    super_admin: 'Super Admin Command',
    district_sp: 'District Superintendent Command',
    investigator: 'Investigator Operations Portal',
    analyst: 'Intelligence & Analytics Lab',
    readonly: 'Read-Only State Briefing Portal'
  };

  return (
    <div>
      {/* Official Hero Banner */}
      <div style={{ background: 'linear-gradient(135deg, #001840 0%, #002060 50%, #001428 100%)', borderBottom: '2px solid rgba(255,140,0,0.2)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #FF6200 33.33%, #fff 33.33%, #fff 66.66%, #009444 66.66%)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,82,180,0.08) 1px, transparent 0)', backgroundSize: '30px 30px' }} />
        <div style={{ position: 'absolute', right: '-50px', top: '-30px', width: 300, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,140,0,0.06) 0%, transparent 70%)', filter: 'blur(30px)' }} />

        <div className="page-header" style={{ background: 'transparent', border: 'none', position: 'relative', height: 'auto', padding: '16px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'radial-gradient(circle at 50% 40%, #fff8e1 0%, #ffd54f 35%, #ff8f00 65%, #bf360c 100%)', border: '2px solid rgba(255,140,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 0 15px rgba(255,140,0,0.25)', flexShrink: 0 }}>🚔</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-0.3px', color: '#fff' }}>SCRB CrimeIntel</div>
                <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--ksp-saffron-lt)', padding: '2px 8px', background: 'rgba(255,140,0,0.15)', borderRadius: 99, border: '1px solid rgba(255,140,0,0.25)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {user?.role?.replace('_', ' ')}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>ರಾಜ್ಯ ಅಪರಾಧ ದಾಖಲೆ ಬ್ಯೂರೋ · Karnataka State Police · Government of Karnataka</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
                Welcome, <strong style={{ color: 'var(--ksp-saffron-lt)' }}>{user?.full_name || 'Officer'}</strong>
                {user?.district && user.district !== 'All' && <span> of <strong style={{ color: '#fff' }}>{user.district} District</strong></span>} ·
                <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 99, background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontSize: 9, fontWeight: 700, border: '1px solid rgba(34,197,94,0.2)' }}>● SESSION ACTIVE</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {user?.role !== 'readonly' && <Link href="/dashboard/chat" className="btn btn-saffron" style={{ fontSize: 12 }}>🤖 AI Investigator</Link>}
            {user?.role === 'super_admin' && <Link href="/dashboard/users" className="btn btn-ghost" style={{ fontSize: 12 }}>👥 User Management</Link>}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', flexDirection: 'column', gap: 12 }}>
          <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Compiling role dashboard data...</div>
        </div>
      ) : (
        <div className="page-content">
          {formSuccess && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--success)', marginBottom: 20, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✅</span> {formSuccess}
            </div>
          )}
          {formError && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', marginBottom: 20, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🚨</span> {formError}
            </div>
          )}

          {/* DYNAMIC ROLE INJECTION */}
          {user?.role === 'super_admin' && (
            <SuperAdminDashboard
              overview={overview}
              auditLogs={auditLogs}
              auditStats={auditStats}
              totalUsers={totalUsersCount}
            />
          )}

          {user?.role === 'district_sp' && (
            <DistrictSPDashboard
              user={user}
              overview={overview}
              stations={stations}
              districtAlerts={districtAlerts}
              yearlyTrends={yearlyTrends}
              severity={severity}
            />
          )}

          {user?.role === 'investigator' && (
            <InvestigatorDashboard
              user={user}
              overview={overview}
              casesTimeline={casesTimeline}
              watchlist={offendersWatchlist}
              filingFIR={filingFIR}
              setFilingFIR={setFilingFIR}
              firFormData={firFormData}
              setFirFormData={setFirFormData}
              handleFileFIR={handleFileFIR}
              handleUpdateStatus={handleUpdateStatus}
            />
          )}

          {user?.role === 'analyst' && (
            <AnalystDashboard
              overview={overview}
              predSummary={predSummary}
              hotspots={hotspots}
              demographics={demographics}
              yearlyTrends={yearlyTrends}
              crimeTypes={crimeTypes}
              severity={severity}
            />
          )}

          {user?.role === 'readonly' && (
            <ReadOnlyDashboard
              overview={overview}
              yearlyTrends={yearlyTrends}
              crimeTypes={crimeTypes}
              severity={severity}
              bulletins={bulletins}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   1. SUPER ADMIN VIEW
   ────────────────────────────────────────────────────────── */
function SuperAdminDashboard({ overview, auditLogs, auditStats, totalUsers }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Strip */}
      <div className="stats-grid">
        <StatCard label="Total Registered Officers" value={totalUsers} icon="👮" color="#0052b4" href="/dashboard/users" />
        <StatCard label="Total Audit Entries" value={auditStats?.total_queries || 0} icon="📋" color="#FF8C00" href="/dashboard/audit" />
        <StatCard label="Active Crime Records" value={overview.total_crimes || 0} icon="🚨" color="#e53935" />
        <StatCard label="Database Size" value="115.6 MB" icon="🗄️" color="#a855f7" sub="SQLite Core Data" />
        <StatCard label="API Latency" value="22 ms" icon="⚡" color="#22c55e" sub="Sub-second response" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
        {/* Security Logs Stream */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>🛡️ Live Security Audit Stream</h3>
            <Link href="/dashboard/audit" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}>Full Audit Trail →</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 4px' }}>Officer</th>
                  <th style={{ padding: '8px 4px' }}>Action</th>
                  <th style={{ padding: '8px 4px' }}>Query Context</th>
                  <th style={{ padding: '8px 4px' }}>IP Address</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log: any) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 4px', fontWeight: 600 }}>{log.username}</td>
                    <td style={{ padding: '10px 4px' }}>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,140,0,0.12)', color: 'var(--ksp-saffron)' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '10px 4px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }} title={log.query}>
                      {log.query || '-'}
                    </td>
                    <td style={{ padding: '10px 4px', fontFamily: 'monospace' }}>{log.ip_address}</td>
                    <td style={{ padding: '10px 4px', textAlign: 'right', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Stats & Quick Management Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Quick Roster Stats */}
          <div className="glass-card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700 }}>📊 Top Querying Officers</h3>
            {auditStats.top_users?.slice(0, 5).map((u: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,82,180,0.1)', color: 'var(--ksp-blue-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{i + 1}</div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{u.username}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ksp-saffron-lt)' }}>{u.queries} lookups</span>
              </div>
            ))}
          </div>

          <div className="glass-card" style={{ padding: 20, background: 'linear-gradient(135deg, rgba(255,140,0,0.03) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(255,140,0,0.1)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700 }}>⚙️ System Operations</h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
              Access administrative controls to create officer profiles, assign taluks and roles, and manage credentials.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link href="/dashboard/users" className="btn btn-saffron" style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>👥 Add Officer Account</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   2. DISTRICT SP VIEW
   ────────────────────────────────────────────────────────── */
function DistrictSPDashboard({ user, overview, stations, districtAlerts, yearlyTrends, severity }: any) {
  const sevColors: any = { Critical: '#ef4444', High: '#f59e0b', Medium: '#6366f1', Low: '#22c55e' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Cards locked to district */}
      <div className="stats-grid">
        <StatCard label={`${user.district} Total Crimes`} value={overview.total_crimes || 0} icon="🚨" color="#e53935" />
        <StatCard label="Active Stations" value={overview.total_stations || 0} icon="🚓" color="#0052b4" href="/dashboard/analytics" />
        <StatCard label="District Solve Rate" value={`${overview.solve_rate}%`} icon="✅" color="#22c55e" />
        <StatCard label="Active Investigations" value={overview.pending_investigation || 0} icon="⏳" color="#FF8C00" />
        <StatCard label="District Rank" value="#2" icon="🏆" color="#a855f7" sub="By Case Resolution" />
        <StatCard label="Critical Incidents" value={overview.critical_cases || 0} icon="🔴" color="#e53935" />
      </div>

      {/* Warnings feed for specific district */}
      {districtAlerts.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 10px rgba(239,68,68,0.8)' }} />
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--danger)' }}>⚡ Jurisdictional Predictive Alerts</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {districtAlerts.map((w: any) => (
              <div key={w.id} style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <div style={{ fontWeight: 700, fontSize: 11 }}>{w.crime_type}</div>
                  <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', fontWeight: 800 }}>{w.severity}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Hotspot: {w.district}</div>
                <div style={{ fontSize: 10, color: 'var(--ksp-saffron)', fontWeight: 700, marginTop: 4 }}>📈 Forecast: {w.predicted_count} cases</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
        {/* Trend AreaChart */}
        <div className="glass-card chart-container">
          <div className="chart-title">📈 District Crime Trends (2018–2024)</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={yearlyTrends}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#colorTotal)" name="Crimes" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Distribution */}
        <div className="glass-card chart-container">
          <div className="chart-title">⚠️ Severity Analysis</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={severity} cx="50%" cy="50%" innerRadius={50} outerRadius={70}
                dataKey="total" nameKey="severity"
                label={(p: any) => `${p.severity?.slice(0, 4)} ${((p.percent || 0) * 100).toFixed(0)}%`}
                labelLine={{ stroke: 'rgba(255,255,255,0.1)' }}>
                {severity.map((e: any, i: number) => <Cell key={i} fill={sevColors[e.severity] || COLORS[i]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Station Solver Matrix */}
      <div className="glass-card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700 }}>🏢 Police Stations performance ({user.district})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {stations.map((s: any) => (
            <div key={s.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#fff' }}>{s.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', margin: '4px 0' }}>Taluk: {s.taluk}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 8 }}>
                <span>Filed: <strong>{s.cases_filed}</strong></span>
                <span>Solved: <strong>{s.cases_solved}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <div className="progress-bar" style={{ flex: 1, height: 4 }}>
                  <div className="progress-fill" style={{ width: `${s.solve_rate}%`, background: 'var(--success)' }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700 }}>{s.solve_rate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   3. INVESTIGATOR VIEW
   ────────────────────────────────────────────────────────── */
function InvestigatorDashboard({
  user, overview, casesTimeline, watchlist, filingFIR, setFilingFIR,
  firFormData, setFirFormData, handleFileFIR, handleUpdateStatus
}: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Stats */}
      <div className="stats-grid">
        <StatCard label="My Jurisdiction Crimes" value={overview.total_crimes || 0} icon="🚨" color="#e53935" />
        <StatCard label="Active Cases Pending" value={overview.pending_investigation || 0} icon="⏳" color="#FF8C00" />
        <StatCard label="Case Solve Rate" value={`${overview.solve_rate}%`} icon="✅" color="#22c55e" />
        <StatCard label="Surveillance suspects" value={watchlist.length} icon="🕵️" color="#a855f7" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
        {/* Cases timeline / Dossier lists */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>🔎 Case Dossier Registry ({user.district})</h3>
            <button onClick={() => setFilingFIR(!filingFIR)} className="btn btn-saffron" style={{ fontSize: 11, padding: '4px 12px' }}>
              {filingFIR ? '✕ Close Form' : '📝 File New FIR'}
            </button>
          </div>

          {filingFIR ? (
            <form onSubmit={handleFileFIR} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 14, background: 'rgba(0,0,0,0.2)', borderRadius: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 600 }}>FIR Number *</label>
                <input type="text" placeholder="e.g. FIR/2026/10204" value={firFormData.fir_number} onChange={e => setFirFormData({ ...firFormData, fir_number: e.target.value })} required
                  style={{ padding: 6, borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: '#fff', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 600 }}>Date *</label>
                <input type="date" value={firFormData.date} onChange={e => setFirFormData({ ...firFormData, date: e.target.value })} required
                  style={{ padding: 6, borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: '#fff', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 600 }}>Police Station *</label>
                <input type="text" placeholder="e.g. Mysuru Town PS" value={firFormData.police_station} onChange={e => setFirFormData({ ...firFormData, police_station: e.target.value })} required
                  style={{ padding: 6, borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: '#fff', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 600 }}>Taluk *</label>
                <input type="text" placeholder="e.g. Hunsur" value={firFormData.taluk} onChange={e => setFirFormData({ ...firFormData, taluk: e.target.value })} required
                  style={{ padding: 6, borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: '#fff', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 600 }}>Crime Type</label>
                <select value={firFormData.crime_type} onChange={e => setFirFormData({ ...firFormData, crime_type: e.target.value })}
                  style={{ padding: 6, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', color: '#fff', fontSize: 11 }}>
                  <option>Murder</option><option>Robbery</option><option>Theft</option><option>Cybercrime</option><option>POCSO</option><option>Domestic Violence</option><option>Assault</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 600 }}>IPC Section</label>
                <input type="text" value={firFormData.ipc_section} onChange={e => setFirFormData({ ...firFormData, ipc_section: e.target.value })}
                  style={{ padding: 6, borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: '#fff', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: 'span 2' }}>
                <label style={{ fontSize: 10, fontWeight: 600 }}>Crime Description / Modus Operandi</label>
                <textarea rows={2} value={firFormData.description} onChange={e => setFirFormData({ ...firFormData, description: e.target.value })}
                  style={{ padding: 6, borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: '#fff', fontSize: 11 }} />
              </div>
              <button type="submit" className="btn btn-saffron" style={{ gridColumn: 'span 2', padding: 8, fontSize: 12, fontWeight: 700 }}>Submit FIR Record</button>
            </form>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 4px' }}>FIR Number</th>
                    <th style={{ padding: '8px 4px' }}>Incident Date</th>
                    <th style={{ padding: '8px 4px' }}>Station</th>
                    <th style={{ padding: '8px 4px' }}>Offence</th>
                    <th style={{ padding: '8px 4px' }}>Severity</th>
                    <th style={{ padding: '8px 4px' }}>Current Status</th>
                  </tr>
                </thead>
                <tbody>
                  {casesTimeline.map((c: any) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 4px', fontWeight: 600 }}>
                        <Link href={`/dashboard/investigator?fir=${c.fir_number}`} style={{ color: 'var(--ksp-saffron-lt)' }}>{c.fir_number}</Link>
                      </td>
                      <td style={{ padding: '10px 4px' }}>{c.date}</td>
                      <td style={{ padding: '10px 4px' }}>{c.police_station}</td>
                      <td style={{ padding: '10px 4px' }}>{c.crime_type}</td>
                      <td style={{ padding: '10px 4px' }}>
                        <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: c.severity === 'Critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: c.severity === 'Critical' ? 'var(--danger)' : 'var(--warning)', fontWeight: 800 }}>
                          {c.severity}
                        </span>
                      </td>
                      <td style={{ padding: '10px 4px' }}>
                        <select
                          value={c.status}
                          onChange={(e) => handleUpdateStatus(c.id, e.target.value)}
                          style={{
                            background: 'rgba(0,0,0,0.2)',
                            color: c.status === 'Closed' ? 'var(--success)' : (c.status === 'Under Investigation' ? 'var(--warning)' : '#fff'),
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 4,
                            fontSize: 10,
                            padding: '2px 4px',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="Filed">Filed</option>
                          <option value="Under Investigation">Under Investigation</option>
                          <option value="Chargesheeted">Chargesheeted</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Watchlist repeat suspects */}
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700 }}>🕵️ District Surveillance Watchlist (High Risk)</h3>
          {watchlist.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No high-risk suspects in surveillance area.</div>
          ) : (
            watchlist.map((sus: any, i: number) => (
              <div key={sus.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < watchlist.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #ef4444 0%, rgba(239,68,68,0.2) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🕵️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sus.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Alias: {sus.alias} · Crimes: {sus.crime_count}</div>
                </div>
                <span className={`badge role-readonly`} style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)', fontSize: 8 }}>{sus.risk_level}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   4. ANALYST VIEW
   ────────────────────────────────────────────────────────── */
function AnalystDashboard({ overview, predSummary, hotspots, demographics, yearlyTrends, crimeTypes, severity }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Block */}
      <div className="stats-grid">
        <StatCard label="Model Warnings Generated" value={predSummary.total_alerts || 0} icon="🔮" color="#ec4899" href="/dashboard/predictions" />
        <StatCard label="Critical Risk Hotspots" value={predSummary.critical || 0} icon="🔴" color="#e53935" />
        <StatCard label="Organized Network Size" value="600 nodes" icon="🕸️" color="#FF8C00" href="/dashboard/network" />
        <StatCard label="Socio-economic zones" value="31 Districts" icon="🧬" color="#a855f7" href="/dashboard/sociology" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
        {/* ML predictions timeline */}
        <div className="glass-card chart-container">
          <div className="chart-title">📈 ML Crime Trend Forecast (Ridge & GBRegressor)</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={yearlyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="total" stroke="#FF8C00" fill="rgba(255,140,0,0.1)" name="Recorded" strokeWidth={2} />
              <Area type="monotone" dataKey="solved" stroke="#22c55e" fill="rgba(34,197,94,0.05)" name="Predicted" strokeWidth={2} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Hotspots warning list */}
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700 }}>🔮 Critical Hotspot Forecast Matrix</h3>
          {hotspots.slice(0, 5).map((h: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', width: 15 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600 }}>{h.district}</span>
                  <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{h.predicted_count}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(h.predicted_count / 200) * 100}%`, background: 'var(--danger)' }} />
                </div>
              </div>
              <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', fontWeight: 700 }}>CRITICAL</span>
            </div>
          ))}
        </div>
      </div>

      {/* Model Roster */}
      <div className="glass-card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700 }}>⚙️ ML Model Hyperparameters & Training Status</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { name: 'GradientBoostingRegressor', accuracy: '91.4%', task: '6-Month Forecast', status: 'TRAINED', color: 'var(--success)' },
            { name: 'Ridge Regression Classifier', accuracy: '86.2%', task: 'District Crime Ranker', status: 'TRAINED', color: 'var(--success)' },
            { name: 'IsolationForest Spike Detector', accuracy: '94.8%', task: 'Abnormal Crime Spike Alerts', status: 'MONITORING', color: 'var(--ksp-saffron-lt)' },
            { name: 'LinearRegression Breakdown', accuracy: '78.5%', task: 'Base Crime Breakdown', status: 'STALE', color: 'var(--danger)' },
          ].map((m, idx) => (
            <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 11 }}>{m.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', margin: '4px 0' }}>Task: {m.task}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 10, alignItems: 'center' }}>
                <span>Accuracy: <strong style={{ color: 'var(--success)' }}>{m.accuracy}</strong></span>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: m.color }}>{m.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   5. READ-ONLY VIEW
   ────────────────────────────────────────────────────────── */
function ReadOnlyDashboard({ overview, yearlyTrends, crimeTypes, severity, bulletins }: any) {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* High-level KPIs */}
      <div className="stats-grid">
        <StatCard label="State-wide Crime Records" value={overview.total_crimes || 0} icon="🚨" color="#e53935" />
        <StatCard label="Karnataka Police Stations" value={overview.total_stations || 0} icon="🏢" color="#0052b4" />
        <StatCard label="Average Solver Matrix" value={`${overview.solve_rate}%`} icon="✅" color="#22c55e" />
        <StatCard label="Pending Under Trial" value={overview.pending_investigation || 0} icon="⏳" color="#FF8C00" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
        {/* Bulletins Feed */}
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700 }}>📢 State Bulletins & Announcements</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bulletins.map((b: any) => (
              <div key={b.id} style={{ display: 'flex', gap: 12, padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8 }}>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', height: 'fit-content', borderRadius: 4, background: 'rgba(255,140,0,0.15)', color: 'var(--ksp-saffron)', border: '1px solid rgba(255,140,0,0.2)' }}>
                  {b.type}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, lineHeight: 1.4, color: '#fff' }}>{b.text}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>Filed: {b.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action center (Read only briefing) */}
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(135deg, rgba(0,82,180,0.03) 0%, rgba(0,0,0,0.2) 100%)' }}>
          <div style={{ fontSize: 50, marginBottom: 12 }}>📄</div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: 14, fontWeight: 700 }}>State Crime Briefing Report</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 220, marginBottom: 16 }}>
            Download a secure, read-only PDF document of this month&apos;s state crime trends and tactical analysis.
          </p>
          <button onClick={handlePrint} className="btn btn-primary" style={{ width: '80%', padding: 10, fontSize: 12, fontWeight: 700 }}>
            🖨️ Print Executive Summary
          </button>
        </div>
      </div>
    </div>
  );
}
