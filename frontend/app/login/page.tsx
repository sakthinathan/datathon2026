'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api.login(username, password);
      localStorage.setItem('scrb_token', data.access_token);
      localStorage.setItem('scrb_user', JSON.stringify(data.user));
      router.push('/dashboard/chat');
    } catch (err: any) {
      setError(err.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u: string, p: string) => { setUsername(u); setPassword(p); };

  if (!mounted) return null;

  return (
    <div className="login-bg">
      {/* Animated background orbs */}
      <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', top:'10%', left:'15%', filter:'blur(60px)' }} />
      <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 70%)', bottom:'20%', right:'20%', filter:'blur(40px)' }} />

      <div className="login-card fade-in">
        <div className="login-logo">
          <div className="login-logo-icon">🚔</div>
          <div className="login-title">SCRB CrimeIntel</div>
          <div className="login-subtitle">Karnataka Crime Intelligence Platform</div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:8 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', animation:'pulse 2s infinite' }} />
            <span style={{ fontSize:11, color:'#22c55e', fontWeight:600 }}>SYSTEM OPERATIONAL</span>
          </div>
        </div>

        {error && <div className="login-error">⚠️ {error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Officer ID / Username</label>
            <input
              id="username"
              type="text"
              className="form-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>
          <button id="login-submit" type="submit" className="login-btn" disabled={loading}>
            {loading ? <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
              <div className="spinner" style={{width:18,height:18}} /> Authenticating...
            </span> : '🔐 Sign In to SCRB'}
          </button>
        </form>

        <div className="demo-credentials">
          <div className="demo-title">🎭 Demo Credentials</div>
          {[
            { label: 'Super Admin', u: 'admin', p: 'admin123', role: 'super_admin' },
            { label: 'District SP', u: 'sp_bengaluru', p: 'password123', role: 'district_sp' },
            { label: 'Investigator', u: 'investigator1', p: 'password123', role: 'investigator' },
            { label: 'Analyst', u: 'analyst1', p: 'password123', role: 'analyst' },
          ].map(({ label, u, p, role }) => (
            <div key={u} className="demo-item" onClick={() => quickLogin(u, p)}
              style={{ cursor:'pointer', padding:'6px 8px', borderRadius:8, transition:'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span className={`badge role-${role}`}>{label}</span>
              </div>
              <span className="demo-cred">{u} / {p}</span>
            </div>
          ))}
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:8 }}>Click any row to auto-fill</div>
        </div>

        <div style={{ textAlign:'center', marginTop:16, fontSize:12, color:'var(--text-muted)' }}>
          🛡️ Secure Access · All sessions are audited · Version 1.0
        </div>
      </div>
    </div>
  );
}
