'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 50;

  useEffect(() => {
    Promise.all([
      api.getAuditLogs(PAGE_SIZE, page * PAGE_SIZE),
      api.getAuditStats(),
    ]).then(([data, s]) => {
      setLogs(data.logs); setTotal(data.total); setStats(s); setLoading(false);
    }).catch(() => setLoading(false));
  }, [page]);

  const filtered = logs.filter(l =>
    !search || l.query?.toLowerCase().includes(search.toLowerCase()) ||
    l.username?.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    window.open('http://localhost:8000/audit/export/csv', '_blank');
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title"><span className="page-icon">📋</span>Audit Trail</div>
        <div style={{ display:'flex', gap:10 }}>
          <input
            type="text"
            placeholder="Search queries or users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding:'8px 14px', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text-primary)', fontSize:13, outline:'none', width:260 }}
          />
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}>⬇️ Export CSV</button>
        </div>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom:24 }}>
          <div className="stat-card" style={{ '--accent-color': 'var(--accent)' } as any}>
            <div className="stat-icon">📊</div>
            <div className="stat-value" style={{ color:'var(--accent)' }}>{stats.total_queries?.toLocaleString() ?? '—'}</div>
            <div className="stat-label">Total AI Queries</div>
          </div>
          <div className="stat-card" style={{ '--accent-color': 'var(--success)' } as any}>
            <div className="stat-icon">👥</div>
            <div className="stat-value" style={{ color:'var(--success)' }}>{stats.top_users?.length ?? '—'}</div>
            <div className="stat-label">Active Users</div>
          </div>
          <div className="stat-card" style={{ '--accent-color': 'var(--warning)' } as any}>
            <div className="stat-icon">📄</div>
            <div className="stat-value" style={{ color:'var(--warning)' }}>{total?.toLocaleString()}</div>
            <div className="stat-label">Log Entries</div>
          </div>
        </div>

        {/* Top Users */}
        {stats.top_users?.length > 0 && (
          <div className="glass-card" style={{ padding:20, marginBottom:20 }}>
            <div className="chart-title">👤 Most Active Users</div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {stats.top_users?.map((u: any) => (
                <div key={u.username} style={{ padding:'8px 14px', background:'var(--bg-glass)', borderRadius:10, border:'1px solid var(--border)', fontSize:13 }}>
                  <span style={{ fontWeight:600, color:'var(--accent-light)' }}>{u.username}</span>
                  <span style={{ color:'var(--text-muted)', marginLeft:8 }}>{u.queries} queries</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logs Table */}
        <div className="glass-card" style={{ padding:'20px 0' }}>
          <div style={{ padding:'0 20px 16px', borderBottom:'1px solid var(--border)' }}>
            <div className="chart-title" style={{ marginBottom:0 }}>🔍 Query Logs</div>
          </div>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner" /></div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th><th>User</th><th>Query</th>
                    <th>SQL Generated</th><th>Results</th><th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l: any) => (
                    <tr key={l.id}>
                      <td style={{ whiteSpace:'nowrap', fontSize:11, color:'var(--text-muted)' }}>
                        {new Date(l.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span style={{ fontWeight:600, color:'var(--accent-light)' }}>{l.username}</span>
                      </td>
                      <td style={{ maxWidth:240 }}>
                        <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:240, fontSize:13 }} title={l.query}>
                          {l.query}
                        </div>
                      </td>
                      <td style={{ maxWidth:200 }}>
                        {l.sql_generated ? (
                          <code style={{ fontSize:10, color:'#a5f3fc', background:'rgba(0,0,0,0.3)', padding:'2px 6px', borderRadius:4, display:'block', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:200 }} title={l.sql_generated}>
                            {l.sql_generated.slice(0,50)}...
                          </code>
                        ) : <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>}
                      </td>
                      <td>
                        <span style={{ fontWeight:600, color: l.result_count > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                          {l.result_count}
                        </span>
                      </td>
                      <td style={{ fontSize:11, color:'var(--text-muted)' }}>{l.ip_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px 0', borderTop:'1px solid var(--border)', marginTop:8 }}>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>
              Showing {page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE, total)} of {total?.toLocaleString()} entries
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p=>p-1)}>← Prev</button>
              <button className="btn btn-ghost btn-sm" disabled={(page+1)*PAGE_SIZE >= total} onClick={() => setPage(p=>p+1)}>Next →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
