'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUser, clearAuth } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/dashboard', icon: '🏠', label: 'Command Center', section: 'Overview' },
  { href: '/dashboard/chat', icon: '🤖', label: 'AI Investigator', section: 'Intelligence' },
  { href: '/dashboard/investigator', icon: '🔎', label: 'Case Intelligence', section: 'Intelligence' },
  { href: '/dashboard/map', icon: '🗺️', label: 'Crime Heatmap', section: 'Intelligence' },
  { href: '/dashboard/network', icon: '🕸️', label: 'Criminal Network', section: 'Intelligence' },
  { href: '/dashboard/financial', icon: '💸', label: 'Financial Crimes', section: 'Intelligence' },
  { href: '/dashboard/analytics', icon: '📊', label: 'Analytics', section: 'Analysis' },
  { href: '/dashboard/predictions', icon: '🔮', label: 'Predictions', section: 'Analysis', badge: '!' },
  { href: '/dashboard/offenders', icon: '🕵️', label: 'Offender Profiling', section: 'Analysis' },
  { href: '/dashboard/sociology', icon: '🧬', label: 'Sociological Insights', section: 'Analysis' },
  { href: '/dashboard/audit', icon: '📋', label: 'Audit Trail', section: 'System' },
];


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const u = getUser();
    const token = localStorage.getItem('scrb_token');
    if (!token || !u) { router.replace('/login'); return; }
    setUser(u);
  }, [router]);

  const handleLogout = () => {
    clearAuth();
    router.replace('/login');
  };

  if (!user) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:16 }}>
      <div className="spinner" style={{ width:40, height:40, borderWidth:3 }} />
      <div style={{ color:'var(--text-muted)', fontSize:14 }}>Authenticating...</div>
    </div>
  );

  const sections = [...new Set(NAV_ITEMS.map(n => n.section))];
  const initials = user.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase() || 'U';

  return (
    <div>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🚔</div>
          <div className="sidebar-logo-text">
            SCRB CrimeIntel
            <span>Karnataka Police</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {sections.map(section => (
            <div key={section}>
              <div className="nav-section-label">{section}</div>
              {NAV_ITEMS.filter(n => n.section === section).map(item => (
                <Link key={item.href} href={item.href}
                  className={`nav-item ${pathname === item.href ? 'active' : ''}`}>
                  <span className="nav-icon">{item.icon}</span>
                  <span style={{ flex:1 }}>{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user.full_name?.split(' ').slice(0,2).join(' ')}</div>
            <div className="user-role">
              <span className={`badge role-${user.role}`}>{user.role?.replace('_',' ')}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-icon btn-ghost" title="Logout" style={{ fontSize:16, marginLeft:4 }}>⏏️</button>
        </div>
      </aside>

      {/* Main */}
      <div className="layout">{children}</div>
    </div>
  );
}
