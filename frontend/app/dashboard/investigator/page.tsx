'use client';
import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';
const CRIME_TYPES = ['All','Murder','Robbery','Theft','Cybercrime','Assault','Fraud','Drug Offense','Kidnapping','POCSO','Domestic Violence','Chain Snatching'];
const DISTRICTS = ['Bengaluru Urban','Mysuru','Hubballi-Dharwad','Mangaluru','Belagavi','Kalaburagi','Ballari','Vijayapura','Shivamogga','Tumakuru','Raichur','Bidar'];

async function fetchAuth(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('scrb_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  return res.json();
}

const SEV_COLOR: any = { Critical:'var(--danger)', High:'var(--warning)', Medium:'var(--accent)', Low:'var(--success)' };
const STATUS_COLOR: any = { 'Closed':'var(--success)', 'Under Investigation':'var(--warning)', 'Chargesheeted':'var(--info)', Filed:'var(--text-muted)', Acquitted:'#64748b', 'Trial Stage':'var(--accent)' };
const STAGES = ['Filed', 'Under Investigation', 'Chargesheeted', 'Trial Stage', 'Closed'];

const STAGE_TASKS: Record<string, string[]> = {
  'Filed': [
    'FIR document verified & signed',
    'Initial GD (General Diary) entry completed',
    'Assigned to Investigating Officer (IO)'
  ],
  'Under Investigation': [
    'Crime scene visited & map coordinates verified',
    'Initial witnesses interviewed & statements recorded',
    'AI leads generated and cross-referenced',
    'Suspects identified & backgrounds verified'
  ],
  'Chargesheeted': [
    'FSL (Forensic Science Lab) reports attached',
    'Draft chargesheet reviewed by Legal Advisor',
    'Formal chargesheet filed in Magistrate Court'
  ],
  'Trial Stage': [
    'Summons served to witnesses',
    'Prosecution testimonies completed',
    'Defense arguments heard'
  ],
  'Closed': [
    'Final court order retrieved & uploaded',
    'Case disposition recorded in CCTNS ledger'
  ]
};

const normalizeStatus = (status: string) => {
  if (status === 'Closed' || status === 'Acquitted') return 'Closed';
  if (status === 'Trial Stage' || status === 'Trial') return 'Trial Stage';
  if (status === 'Chargesheeted') return 'Chargesheeted';
  if (status === 'Under Investigation') return 'Under Investigation';
  return 'Filed';
};

export default function InvestigatorPage() {
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [caseSummary, setCaseSummary] = useState<any>(null);
  const [leads, setLeads] = useState<any>(null);
  const [similarCases, setSimilarCases] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('Bengaluru Urban');
  const [timelineType, setTimelineType] = useState('All');
  const [activeTab, setActiveTab] = useState<'search'|'timeline'>('search');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [checkedTasks, setCheckedTasks] = useState<Record<number, Record<string, boolean>>>({});

  const toggleTask = (caseId: number, taskName: string) => {
    setCheckedTasks(prev => {
      const caseTasks = prev[caseId] || {};
      const newCaseTasks = { ...caseTasks, [taskName]: !caseTasks[taskName] };
      return { ...prev, [caseId]: newCaseTasks };
    });
  };

  const updateCaseStatus = async (newStatus: string) => {
    if (!selectedCase) return;
    try {
      const res = await fetchAuth(`/investigator/crimes/${selectedCase.id}/update-status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus })
      });
      if (res && res.status) {
        setCaseSummary((prev: any) => prev ? { ...prev, status: newStatus } : null);
        setSelectedCase((prev: any) => prev ? { ...prev, status: newStatus } : null);
        setSearchResults((prev: any[]) => prev.map(c => c.id === selectedCase.id ? { ...c, status: newStatus } : c));
      }
    } catch (e) {
      console.error("Failed to update status:", e);
    }
  };

  const currentStage = caseSummary ? normalizeStatus(caseSummary.status) : 'Filed';
  const stageTasksList = STAGE_TASKS[currentStage] || [];
  const caseChecked = checkedTasks[selectedCase?.id || 0] || {};
  const completedCount = stageTasksList.filter(t => caseChecked[t]).length;
  const totalTasks = stageTasksList.length;

  const doSearch = async () => {
    if (!searchQ.trim()) return;
    setLoadingSearch(true);
    try {
      const results = await fetchAuth(`/investigator/search-cases?q=${encodeURIComponent(searchQ)}&limit=20`);
      setSearchResults(results);
    } catch(e) { setSearchResults([]); }
    setLoadingSearch(false);
  };

  const selectCase = async (c: any) => {
    setSelectedCase(c);
    setCaseSummary(null); setLeads(null); setSimilarCases([]);
    setLoadingSummary(true);
    try {
      const [sum, sim] = await Promise.all([
        fetchAuth(`/investigator/case-summary/${c.id}`),
        fetchAuth(`/investigator/similar-cases?crime_type=${encodeURIComponent(c.crime_type)}&district=${encodeURIComponent(c.district)}&limit=5`),
      ]);
      setCaseSummary(sum); setSimilarCases(sim.filter((s: any) => s.id !== c.id));
    } catch(e) {}
    setLoadingSummary(false);
  };

  const generateLeads = async () => {
    if (!selectedCase) return;
    setLeads(null);
    try {
      const l = await fetchAuth(`/investigator/generate-leads?crime_id=${selectedCase.id}`, { method:'POST' });
      setLeads(l);
    } catch(e) {}
  };

  useEffect(() => {
    setLoadingTimeline(true);
    const q = timelineType !== 'All' ? `&crime_type=${encodeURIComponent(timelineType)}` : '';
    fetchAuth(`/investigator/case-timeline/${encodeURIComponent(selectedDistrict)}?limit=40${q}`)
      .then(setTimeline).catch(() => setTimeline([])).finally(() => setLoadingTimeline(false));
  }, [selectedDistrict, timelineType]);

  return (
    <div>
      <div className="page-header">
        <div className="page-title"><span className="page-icon">🔎</span>Case Intelligence</div>
        <div style={{ display:'flex', gap:8 }}>
          <button className={`btn btn-${activeTab==='search'?'primary':'ghost'}`} onClick={() => setActiveTab('search')}>🔍 Case Search</button>
          <button className={`btn btn-${activeTab==='timeline'?'primary':'ghost'}`} onClick={() => setActiveTab('timeline')}>📅 District Timeline</button>
        </div>
      </div>

      <div className="page-content">
        {activeTab === 'search' ? (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:20 }}>
            {/* Left Panel */}
            <div>
              {/* Search Bar */}
              <div className="glass-card" style={{ padding:20, marginBottom:20 }}>
                <div className="chart-title" style={{ marginBottom:12 }}>🔍 Search Cases</div>
                <div style={{ display:'flex', gap:10 }}>
                  <input
                    type="text" className="chat-input" placeholder="Enter FIR number, district, crime type, or description..."
                    value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doSearch()}
                    style={{ flex:1, padding:'10px 16px' }}
                  />
                  <button className="btn btn-primary" onClick={doSearch} disabled={loadingSearch}>
                    {loadingSearch ? <span className="spinner" style={{ width:16, height:16, borderWidth:2 }} /> : '🔍 Search'}
                  </button>
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="glass-card" style={{ padding:'20px 0', marginBottom:20 }}>
                  <div style={{ padding:'0 20px 12px', borderBottom:'1px solid var(--border)' }}>
                    <div className="chart-title" style={{ marginBottom:0 }}>
                      📁 {searchResults.length} Results Found
                    </div>
                  </div>
                  <div style={{ maxHeight:380, overflowY:'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr><th>FIR Number</th><th>Date</th><th>District</th><th>Crime Type</th><th>Severity</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {searchResults.map((c: any) => (
                          <tr key={c.id} onClick={() => selectCase(c)} style={{ cursor:'pointer' }}>
                            <td><code style={{ fontSize:11, color:'#a5f3fc', background:'rgba(0,0,0,0.3)', padding:'2px 6px', borderRadius:4 }}>{c.fir_number}</code></td>
                            <td style={{ fontSize:12, color:'var(--text-muted)' }}>{c.date}</td>
                            <td style={{ fontSize:12 }}>{c.district}</td>
                            <td style={{ fontWeight:500 }}>{c.crime_type}</td>
                            <td><span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, fontWeight:700, background:`${SEV_COLOR[c.severity]}22`, color:SEV_COLOR[c.severity], border:`1px solid ${SEV_COLOR[c.severity]}44` }}>{c.severity}</span></td>
                            <td><span style={{ fontSize:11, color:STATUS_COLOR[c.status] }}>{c.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Similar Cases */}
              {similarCases.length > 0 && (
                <div className="glass-card" style={{ padding:20 }}>
                  <div className="chart-title">🔗 Similar Cases (Same MO & District)</div>
                  {similarCases.map((c: any) => (
                    <div key={c.id} onClick={() => selectCase(c)} style={{ padding:'10px 0', borderBottom:'1px solid var(--border)', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <code style={{ fontSize:11, color:'#a5f3fc', background:'rgba(0,0,0,0.3)', padding:'2px 6px', borderRadius:4, marginRight:8 }}>{c.fir_number}</code>
                        <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{c.crime_type} · {c.district}</span>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{c.description}</div>
                      </div>
                      <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, fontWeight:700, background:`${SEV_COLOR[c.severity]}22`, color:SEV_COLOR[c.severity], whiteSpace:'nowrap', marginLeft:8 }}>{c.severity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Panel - Case Details */}
            <div>
              {loadingSummary ? (
                <div className="glass-card" style={{ padding:40, textAlign:'center' }}>
                  <div className="spinner" style={{ width:32, height:32, margin:'0 auto 12px' }} />
                  <div style={{ color:'var(--text-muted)', fontSize:13 }}>Generating AI Case Summary...</div>
                </div>
              ) : caseSummary ? (
                <div className="glass-card" style={{ padding:24, position:'sticky', top:80 }}>
                  {/* Header */}
                  <div style={{ marginBottom:16, paddingBottom:12, borderBottom:'1px solid var(--border)' }}>
                    <code style={{ fontSize:12, color:'#a5f3fc', background:'rgba(0,0,0,0.4)', padding:'4px 10px', borderRadius:6, display:'block', marginBottom:8 }}>{caseSummary.fir_number}</code>
                    <div style={{ fontWeight:700, fontSize:15 }}>{caseSummary.crime_type}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{caseSummary.district} · {caseSummary.date}</div>
                    <div style={{ marginTop:6, display:'flex', gap:6 }}>
                      <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, fontWeight:700, background:`${SEV_COLOR[caseSummary.severity]}22`, color:SEV_COLOR[caseSummary.severity] }}>{caseSummary.severity}</span>
                      <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, fontWeight:700, background:'rgba(99,102,241,0.15)', color:'var(--accent-light)' }}>{caseSummary.status}</span>
                      {caseSummary.ai_generated && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, background:'rgba(34,197,94,0.15)', color:'var(--success)', fontWeight:600 }}>✨ AI</span>}
                    </div>
                  </div>

                  {/* Summary */}
                  <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6, marginBottom:14 }}>{caseSummary.summary}</div>

                  {/* Key Facts */}
                  {caseSummary.key_facts?.length > 0 && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-muted)', marginBottom:8 }}>Key Facts</div>
                      {caseSummary.key_facts.map((f: string, i: number) => (
                        <div key={i} style={{ fontSize:12, color:'var(--text-secondary)', display:'flex', gap:6, marginBottom:4 }}>
                          <span>•</span><span>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Stats row */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                    {[['IPC Section', caseSummary.ipc_section], ['Victims', caseSummary.victim_count], ['Accused', caseSummary.accused_count], ['Station', caseSummary.police_station?.split(' ').slice(0,2).join(' ')]].map(([k,v]) => (
                      <div key={String(k)} style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'8px 10px', border:'1px solid var(--border)' }}>
                        <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>{k}</div>
                        <div style={{ fontSize:12, fontWeight:700 }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recommended Actions */}
                  {caseSummary.recommended_actions?.length > 0 && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-muted)', marginBottom:8 }}>Recommended Actions</div>
                      {caseSummary.recommended_actions.map((a: string, i: number) => (
                        <div key={i} style={{ fontSize:12, color:'var(--accent-light)', display:'flex', gap:6, marginBottom:4 }}>
                          <span>→</span><span>{a}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Case Workflow Stepper */}
                  <div style={{ marginTop:16, borderTop:'1px solid var(--border)', paddingTop:16, marginBottom:16 }}>
                    <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-muted)', marginBottom:12 }}>
                      Case Progression Workflow
                    </div>
                    
                    <div style={{ display:'flex', justifyContent:'space-between', position:'relative', marginBottom:20 }}>
                      <div style={{ position:'absolute', top:10, left:10, right:10, height:2, background:'rgba(255,255,255,0.05)', zIndex:1 }} />
                      <div style={{
                        position:'absolute', top:10, left:10,
                        width:`${(STAGES.indexOf(currentStage) / (STAGES.length - 1)) * 90}%`,
                        height:2, background:'var(--accent-light)', zIndex:1, transition:'width 0.3s ease'
                      }} />

                      {STAGES.map((st, idx) => {
                        const isPast = STAGES.indexOf(currentStage) >= idx;
                        const isActive = currentStage === st;
                        return (
                          <div key={st} style={{ zIndex:2, display:'flex', flexDirection:'column', alignItems:'center', cursor:'pointer' }}
                               onClick={() => updateCaseStatus(st)}>
                            <div style={{
                              width:20, height:20, borderRadius:'50%',
                              background: isActive ? 'var(--accent)' : isPast ? 'var(--accent-light)' : 'var(--bg-secondary)',
                              border:`2px solid ${isActive || isPast ? 'var(--accent-light)' : 'rgba(255,255,255,0.2)'}`,
                              display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700,
                              color: isActive || isPast ? '#fff' : 'var(--text-muted)', transition:'all 0.2s'
                            }}>
                              {idx + 1}
                            </div>
                            <span style={{ fontSize:8, marginTop:4, color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: isActive ? 700 : 500, whiteSpace:'nowrap' }}>
                              {st === 'Under Investigation' ? 'Investigating' : st === 'Trial Stage' ? 'Trial' : st}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {currentStage && (
                      <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)', borderRadius:8, padding:12, marginBottom:12 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:8, display:'flex', justifyContent:'space-between' }}>
                          <span>📋 Stage Checklist: {currentStage}</span>
                          <span style={{ fontSize:10, color:'var(--text-muted)' }}>
                            {completedCount}/{totalTasks} tasks
                          </span>
                        </div>
                        {stageTasksList.map((task: string) => {
                          const isChecked = caseChecked[task] || false;
                          return (
                            <label key={task} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'var(--text-secondary)', marginBottom:6, cursor:'pointer' }}>
                              <input type="checkbox" checked={isChecked} onChange={() => toggleTask(selectedCase.id, task)} style={{ accentColor:'var(--accent)' }} />
                              <span style={{ textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1 }}>
                                {task}
                              </span>
                            </label>
                          );
                        })}
                        
                        {completedCount === totalTasks && STAGES.indexOf(currentStage) < STAGES.length - 1 && (
                          <button className="btn btn-ghost" style={{ width:'100%', marginTop:8, fontSize:10, color:'var(--success)', border:'1px dashed var(--success)', padding:'6px', borderRadius:6, textTransform:'uppercase', fontWeight:600 }}
                                  onClick={() => {
                                    const nextSt = STAGES[STAGES.indexOf(currentStage) + 1];
                                    updateCaseStatus(nextSt);
                                  }}>
                            ✅ Complete Stage & Proceed to {STAGES[STAGES.indexOf(currentStage) + 1]}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Generate Leads Button */}
                  <button className="btn btn-primary" style={{ width:'100%', marginBottom:12 }} onClick={generateLeads}>
                    🧠 Generate Investigative Leads
                  </button>

                  {/* AI Leads */}
                  {leads && (
                    <div style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:10, padding:14 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--accent-light)', marginBottom:10 }}>🔮 AI-Generated Leads</div>
                      {leads.immediate_actions?.map((a: string, i: number) => (
                        <div key={i} style={{ fontSize:12, color:'var(--text-secondary)', display:'flex', gap:6, marginBottom:4 }}>
                          <span style={{ color:'var(--warning)' }}>⚡</span><span>{a}</span>
                        </div>
                      ))}
                      {leads.evidence_to_collect?.map((e: string, i: number) => (
                        <div key={i} style={{ fontSize:12, color:'var(--text-secondary)', display:'flex', gap:6, marginBottom:4 }}>
                          <span style={{ color:'#22c55e' }}>🔬</span><span>{e}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="glass-card" style={{ padding:40, textAlign:'center' }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>🔎</div>
                  <div style={{ color:'var(--text-muted)', fontSize:14 }}>Search and click a case to see its AI-generated summary and investigative leads</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Timeline Tab */
          <div>
            <div className="glass-card" style={{ padding:20, marginBottom:20 }}>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <div style={{ flex:1 }}>
                  <div className="chart-title" style={{ marginBottom:8 }}>📅 Case Timeline</div>
                  <div style={{ display:'flex', gap:10 }}>
                    <select className="filter-select" value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)}>
                      {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                    <select className="filter-select" value={timelineType} onChange={e => setTimelineType(e.target.value)}>
                      <option>All</option>
                      {CRIME_TYPES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ textAlign:'right', color:'var(--text-muted)', fontSize:12 }}>
                  {timeline.length} cases shown
                </div>
              </div>
            </div>

            {loadingTimeline ? (
              <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div className="spinner" style={{ width:36, height:36 }} /></div>
            ) : (
              <div style={{ position:'relative', paddingLeft:24 }}>
                <div style={{ position:'absolute', left:10, top:0, bottom:0, width:2, background:'rgba(99,102,241,0.2)', borderRadius:2 }} />
                {timeline.map((c: any, i: number) => (
                  <div key={c.id} className="fade-in" style={{ display:'flex', gap:16, marginBottom:16, position:'relative' }}>
                    <div style={{
                      width:12, height:12, borderRadius:'50%', flexShrink:0, marginTop:4,
                      background: c.severity === 'Critical' ? 'var(--danger)' : c.severity === 'High' ? 'var(--warning)' : 'var(--accent)',
                      boxShadow: `0 0 8px ${c.severity === 'Critical' ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.4)'}`
                    }} />
                    <div className="glass-card" style={{ flex:1, padding:'12px 16px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                        <div>
                          <code style={{ fontSize:10, color:'#a5f3fc', background:'rgba(0,0,0,0.3)', padding:'1px 5px', borderRadius:4 }}>{c.fir_number}</code>
                          <span style={{ marginLeft:8, fontWeight:600, fontSize:13 }}>{c.crime_type}</span>
                        </div>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ fontSize:11, color:STATUS_COLOR[c.status] }}>{c.status}</span>
                          <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:`${SEV_COLOR[c.severity]}22`, color:SEV_COLOR[c.severity], fontWeight:700 }}>{c.severity}</span>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:16, fontSize:11, color:'var(--text-muted)' }}>
                        <span>📅 {c.date}</span>
                        {c.time && <span>🕐 {c.time}</span>}
                        <span>🚓 {c.police_station?.split(' ').slice(0,3).join(' ')}</span>
                        <span>⚖️ {c.ipc_section}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
