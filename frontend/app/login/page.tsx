'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [mounted,  setMounted]  = useState(false);
  const [time,     setTime]     = useState('');

  useEffect(() => {
    setMounted(true);
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false })
        + '  IST  ' + now.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api.login(username, password);
      localStorage.setItem('scrb_token', data.access_token);
      localStorage.setItem('scrb_user', JSON.stringify(data.user));
      router.push('/dashboard/chat');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u: string, p: string) => { setUsername(u); setPassword(p); };
  if (!mounted) return null;

  return (
    <div className="login-bg">
      {/* Decorative animated blobs */}
      <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(0,51,128,0.12) 0%, transparent 70%)', top:'5%', left:'5%', filter:'blur(70px)', animation:'float 8s ease-in-out infinite' }} />
      <div style={{ position:'absolute', width:350, height:350, borderRadius:'50%', background:'radial-gradient(circle, rgba(255,140,0,0.07) 0%, transparent 70%)', bottom:'10%', right:'8%', filter:'blur(50px)', animation:'float 6s ease-in-out infinite reverse' }} />
      <div style={{ position:'absolute', width:250, height:250, borderRadius:'50%', background:'radial-gradient(circle, rgba(26,107,58,0.06) 0%, transparent 70%)', top:'60%', left:'20%', filter:'blur(40px)' }} />

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:460 }}>

        {/* Official GoK Header above card */}
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', letterSpacing:'0.5px', marginBottom:4 }}>
            🏛️ GOVERNMENT OF KARNATAKA — OFFICIAL SYSTEM
          </div>
          <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, color:'rgba(255,140,0,0.5)', letterSpacing:'1px' }}>
            {time}
          </div>
        </div>

        <div className="login-card fade-in">
          {/* Card Header — KSP Emblem */}
          <div className="login-card-header">
            {/* KSP Crest */}
            <div className="login-emblem">🚔</div>
            <div className="login-org-title">Karnataka State Police</div>
            <div className="login-org-sub">ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್</div>
            <div className="login-dept">State Crime Records Bureau · Intelligence Division</div>
          </div>

          {/* Karnataka tricolor stripe */}
          <div className="login-flag-stripe" />

          {/* Form */}
          <div className="login-form-section">
            {/* System status badge */}
            <div className="login-system-badge">
              SCRB CrimeIntel — Authorised Personnel Only
            </div>

            <div className="login-title">Officer Sign In</div>
            <div className="login-subtitle">Enter your credentials to access the intelligence platform</div>

            {error && <div className="login-error">⚠️ {error}</div>}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label" htmlFor="username">Officer ID / Username</label>
                <input
                  id="username" type="text" className="form-input"
                  value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. admin / sp_bengaluru"
                  required autoComplete="username"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  id="password" type="password" className="form-input"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required autoComplete="current-password"
                />
              </div>
              <button id="login-submit" type="submit" className="login-btn" disabled={loading}>
                {loading
                  ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                      <div className="spinner" style={{ width:17, height:17 }} />
                      Authenticating...
                    </span>
                  : '🔐 Sign In to SCRB'}
              </button>
            </form>

            {/* Demo Credentials */}
            <div className="demo-credentials">
              <div className="demo-title">🎭 Demo Credentials (click to fill)</div>
              {[
                { label: 'Super Admin',  u: 'admin',        p: 'admin123',    role: 'super_admin' },
                { label: 'District SP',  u: 'sp_bengaluru', p: 'password123', role: 'district_sp' },
                { label: 'Investigator', u: 'investigator1',p: 'password123', role: 'investigator' },
                { label: 'Analyst',      u: 'analyst1',     p: 'password123', role: 'analyst' },
              ].map(({ label, u, p, role }) => (
                <div key={u} className="demo-item" onClick={() => quickLogin(u, p)}
                  style={{ cursor:'pointer', padding:'5px 7px', borderRadius:7, transition:'all 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,82,180,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <span className={`badge role-${role}`}>{label}</span>
                  </div>
                  <span className="demo-cred">{u} / {p}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ textAlign:'center', marginTop:16, fontSize:11, color:'var(--text-muted)', lineHeight:1.6 }}>
              🛡️ Secure Access · All sessions are logged and audited
              <br />
              <span style={{ fontSize:10 }}>Emergency: <strong style={{ color:'var(--ksp-saffron)' }}>112</strong> · Police Control Room: <strong style={{ color:'var(--ksp-saffron)' }}>100</strong></span>
            </div>
          </div>
        </div>

        {/* Official footer links */}
        <div style={{ textAlign:'center', marginTop:14, display:'flex', justifyContent:'center', gap:16, fontSize:10, color:'rgba(255,255,255,0.2)' }}>
          <span>ksp.karnataka.gov.in</span>
          <span>·</span>
          <span>karnataka.gov.in</span>
          <span>·</span>
          <span>Version 1.0 · SCRB 2025</span>
        </div>
      </div>
    </div>
  );
}
