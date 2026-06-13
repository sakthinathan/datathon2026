'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUser, clearAuth } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/dashboard',              icon: '🏠', label: 'Command Center',      section: 'Overview' },
  { href: '/dashboard/chat',         icon: '🤖', label: 'AI Investigator',     section: 'Intelligence' },
  { href: '/dashboard/investigator', icon: '🔎', label: 'Case Intelligence',   section: 'Intelligence' },
  { href: '/dashboard/map',          icon: '🗺️', label: 'Crime Heatmap',       section: 'Intelligence' },
  { href: '/dashboard/network',      icon: '🕸️', label: 'Criminal Network',    section: 'Intelligence' },
  { href: '/dashboard/financial',    icon: '💸', label: 'Financial Crimes',    section: 'Intelligence' },
  { href: '/dashboard/analytics',    icon: '📊', label: 'Analytics',           section: 'Analysis' },
  { href: '/dashboard/predictions',  icon: '🔮', label: 'Predictions',         section: 'Analysis', badge: 'ML' },
  { href: '/dashboard/offenders',    icon: '🕵️', label: 'Offender Profiling',  section: 'Analysis' },
  { href: '/dashboard/sociology',    icon: '🧬', label: 'Sociological Insights',section: 'Analysis' },
  { href: '/dashboard/users',        icon: '👥', label: 'User Management',     section: 'System' },
  { href: '/dashboard/audit',        icon: '📋', label: 'Audit Trail',         section: 'System' },
];

const ROLE_NAV_RULES: { [key: string]: string[] } = {
  '/dashboard':             ['super_admin', 'district_sp', 'investigator', 'analyst', 'readonly'],
  '/dashboard/chat':        ['super_admin', 'district_sp', 'investigator', 'analyst'],
  '/dashboard/investigator':['super_admin', 'district_sp', 'investigator', 'analyst', 'readonly'],
  '/dashboard/map':         ['super_admin', 'district_sp', 'investigator', 'analyst', 'readonly'],
  '/dashboard/network':     ['super_admin', 'district_sp', 'investigator', 'analyst'],
  '/dashboard/financial':   ['super_admin', 'district_sp', 'investigator', 'analyst'],
  '/dashboard/analytics':   ['super_admin', 'district_sp', 'analyst', 'readonly'],
  '/dashboard/predictions':  ['super_admin', 'district_sp', 'investigator', 'analyst', 'readonly'],
  '/dashboard/offenders':    ['super_admin', 'district_sp', 'investigator', 'analyst'],
  '/dashboard/sociology':    ['super_admin', 'district_sp', 'analyst', 'readonly'],
  '/dashboard/users':        ['super_admin'],
  '/dashboard/audit':        ['super_admin'],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [time, setTime] = useState('');

  useEffect(() => {
    const u     = getUser();
    const token = localStorage.getItem('scrb_token');
    if (!token || !u) { router.replace('/login'); return; }
    
    // Route guard check
    const allowed = ROLE_NAV_RULES[pathname];
    if (allowed && !allowed.includes(u.role)) {
      router.replace('/dashboard');
      return;
    }
    
    setUser(u);
  }, [router, pathname]);

  // Live clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => { clearAuth(); router.replace('/login'); };

  if (!user) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:16 }}>
      <div className="spinner" style={{ width:40, height:40, borderWidth:3 }} />
      <div style={{ color:'var(--text-muted)', fontSize:14 }}>Authenticating officer...</div>
    </div>
  );

  const allowedItems = NAV_ITEMS.filter(item => {
    const allowed = ROLE_NAV_RULES[item.href];
    return allowed && allowed.includes(user.role);
  });
  const sections  = [...new Set(allowedItems.map(n => n.section))];
  const initials  = user.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase() || 'KP';
  const dateStr   = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

  return (
    <div>
      {/* ── Sidebar ── */}
      <aside className="sidebar">

        {/* KSP Logo Header */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-header">
            {/* Emblem */}
            <div className="sidebar-emblem">🚔</div>
            <div className="sidebar-logo-text">
              <div className="sidebar-logo-title">SCRB CrimeIntel</div>
              <div className="sidebar-logo-subtitle">ರಾಜ್ಯ ಅಪರಾಧ ದಾಖಲೆ ಬ್ಯೂರೋ</div>
              <div className="sidebar-logo-dept">Karnataka State Police · GoK</div>
            </div>
          </div>
          {/* Karnataka flag stripe */}
          <div className="sidebar-flag-stripe" />
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {sections.map(section => (
            <div key={section}>
              <div className="nav-section-label">{section}</div>
              {allowedItems.filter(n => n.section === section).map(item => (
                <Link key={item.href} href={item.href}
                  className={`nav-item ${pathname === item.href ? 'active' : ''}`}>
                  <span className="nav-icon">{item.icon}</span>
                  <span style={{ flex:1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{ fontSize:8, fontWeight:800, padding:'2px 5px', borderRadius:4,
                      background:'rgba(255,140,0,0.2)', color:'var(--ksp-saffron-lt)',
                      border:'1px solid rgba(255,140,0,0.3)', letterSpacing:'0.5px' }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* System status strip */}
        <div style={{ padding:'8px 14px', borderTop:'1px solid rgba(0,82,180,0.15)', background:'rgba(0,0,0,0.15)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:10, color:'var(--text-muted)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 6px rgba(34,197,94,0.6)' }} />
              <span style={{ color:'rgba(255,255,255,0.35)' }}>SYSTEM ONLINE</span>
            </div>
            <span style={{ fontFamily:'JetBrains Mono, monospace', color:'rgba(255,255,255,0.3)' }}>{time}</span>
          </div>
          <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:3, textAlign:'center', letterSpacing:'0.3px' }}>
            Emergency: <span style={{ color:'var(--ksp-saffron)', fontWeight:700 }}>112</span> · Helpline: 100
          </div>
        </div>

        {/* Officer Info */}
        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user.full_name?.split(' ').slice(0,2).join(' ')}</div>
            <div className="user-role">
              <span className={`badge role-${user.role}`}>{user.role?.replace('_',' ')}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-icon btn-ghost" title="Sign Out"
            style={{ fontSize:15, marginLeft:4, color:'var(--text-muted)' }}>⏏️</button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="layout">
        {/* Top utility bar */}
        <div className="ksp-topbar">
          <div className="ksp-topbar-left">
            <span>📅 {dateStr}</span>
            <span>·</span>
            <span>🏛️ Government of Karnataka</span>
            <span>·</span>
            <span>Karnataka State Police — SCRB</span>
          </div>
          <div className="ksp-topbar-right">
            <span className="ksp-topbar-emergency">
              🚨 Emergency: 112
            </span>
            <span style={{ color:'rgba(255,255,255,0.2)' }}>|</span>
            <span className="ksp-topbar-link">Helpline: 100</span>
            <span className="ksp-topbar-link">Women: 1091</span>
            <span className="ksp-topbar-link">Cyber: 1930</span>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
