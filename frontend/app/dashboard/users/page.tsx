'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser } from '@/lib/api';

const ROLES = [
  { value: 'readonly', label: 'Read-Only Viewer' },
  { value: 'analyst', label: 'Crime Analyst' },
  { value: 'investigator', label: 'Case Investigator' },
  { value: 'district_sp', label: 'District SP' },
  { value: 'super_admin', label: 'Super Admin' },
];

const DISTRICTS = [
  "All",
  "Bengaluru Urban",
  "Mysuru",
  "Hubballi-Dharwad",
  "Mangaluru",
  "Belagavi",
  "Kalaburagi",
  "Ballari",
  "Vijayapura",
  "Shivamogga",
  "Tumakuru",
  "Raichur",
  "Bidar",
  "Yadgir",
  "Dharwad",
  "Gadag",
  "Haveri",
  "Uttara Kannada",
  "Dakshina Kannada",
  "Udupi",
  "Chikkamagaluru",
  "Hassan",
  "Kodagu",
  "Mandya",
  "Chamarajanagar",
  "Ramanagara",
  "Chikkaballapur",
  "Kolar",
  "Bengaluru Rural",
  "Chitradurga",
  "Davanagere",
  "Koppal"
];

export default function UserManagementPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('readonly');
  const [district, setDistrict] = useState('All');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    api.listUsers()
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to retrieve officer roster');
        setLoading(false);
      });
  };

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'super_admin') {
      router.replace('/dashboard');
      return;
    }
    setCurrentUser(u);
    fetchUsers();
  }, [router]);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !fullName || !password) {
      setError('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');

    api.createUser({
      username,
      password,
      full_name: fullName,
      role,
      district,
    })
      .then((res) => {
        setSuccess(`Account for ${fullName} created successfully.`);
        setUsername('');
        setFullName('');
        setPassword('');
        setRole('readonly');
        setDistrict('All');
        setSubmitting(false);
        fetchUsers();
      })
      .catch((err) => {
        setError(err.message || 'Failed to create officer account');
        setSubmitting(false);
      });
  };

  const handleToggleStatus = (id: number, name: string) => {
    setError('');
    setSuccess('');
    api.toggleUserStatus(id)
      .then((res) => {
        setSuccess(`Status updated for ${name}.`);
        fetchUsers();
      })
      .catch((err) => {
        setError(err.message || 'Failed to toggle account status');
      });
  };

  if (loading && users.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Accessing officer records database...</div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Government Banner style Header */}
      <div style={{
        background: 'linear-gradient(135deg, #001840 0%, #002c6b 100%)',
        padding: '24px 28px',
        borderRadius: 16,
        marginBottom: 24,
        borderBottom: '2px solid var(--ksp-saffron)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', right: -30, top: -10, fontSize: 120, opacity: 0.05 }}>👥</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>👥</span> User Management & Access Governance
        </h1>
        <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
          Create and manage officer credentials, configure secure role-based access levels, and audit account states.
        </p>
      </div>

      {/* Messaging Banners */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', marginBottom: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🚨</span> {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--success)', marginBottom: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✅</span> {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
        {/* Officer Roster Column */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>👮 Active Officer Roster ({users.length})</h2>
            <button onClick={fetchUsers} className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>🔄 Refresh</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>Officer Name</th>
                  <th style={{ padding: '10px 8px' }}>Username</th>
                  <th style={{ padding: '10px 8px' }}>Assigned Role</th>
                  <th style={{ padding: '10px 8px' }}>Jurisdiction</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Account State</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = currentUser && currentUser.id === u.id;
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background-color 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>{u.full_name}</td>
                      <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>{u.username}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className={`badge role-${u.role}`} style={{ textTransform: 'uppercase', fontSize: 9 }}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {u.district === 'All' ? '🌐 State-wide' : `📍 ${u.district}`}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 700,
                          background: u.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          color: u.is_active ? 'var(--success)' : 'var(--danger)',
                          border: `1px solid ${u.is_active ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`
                        }}>
                          {u.is_active ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        {isSelf ? (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Current Session</span>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(u.id, u.full_name)}
                            className={`btn ${u.is_active ? 'btn-ghost' : 'btn-primary'}`}
                            style={{
                              fontSize: 10,
                              padding: '2px 8px',
                              borderColor: u.is_active ? 'var(--danger)' : 'var(--success)',
                              color: u.is_active ? 'var(--danger)' : 'var(--success)',
                              background: 'transparent'
                            }}
                          >
                            {u.is_active ? '🚫 Deactivate' : '🔓 Enable'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Account Provisioning Column */}
        <div className="glass-card" style={{ padding: 24, height: 'fit-content' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px 0' }}>🆕 Register New Officer</h2>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Inspector Santosh Patil"
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border)',
                  color: '#fff',
                  fontSize: 12
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Login Username *</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="e.g. spatil"
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border)',
                  color: '#fff',
                  fontSize: 12
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Initial Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border)',
                  color: '#fff',
                  fontSize: 12
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Role Designation</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: '#fff',
                  fontSize: 12
                }}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>District Jurisdiction</label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: '#fff',
                  fontSize: 12
                }}
                disabled={role === 'super_admin' || role === 'analyst'}
              >
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d === 'All' ? '🌐 All Districts (State)' : `📍 ${d}`}</option>
                ))}
              </select>
              {(role === 'super_admin' || role === 'analyst') && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  * System admins and analysts require full state access.
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-saffron"
              style={{ width: '100%', padding: '10px', fontWeight: 700, fontSize: 13, marginTop: 10 }}
            >
              {submitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
