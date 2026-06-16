'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api, getUser } from '@/lib/api';
import jsPDF from 'jspdf';

interface Message {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  sql_query?: string;
  insights?: string[];
  timestamp?: string;
  language?: string;
  result_count?: number;
}


interface Session { id: number; title: string; created_at: string; message_count: number; }

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<{ en: string[]; kn: string[] }>({ en: [], kn: [] });
  const [lang, setLang] = useState<'en' | 'kn'>('en');
  const [isRecording, setIsRecording] = useState(false);
  const [showSql, setShowSql] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const user = getUser();

  useEffect(() => {
    api.getSessions().then(setSessions).catch(() => {});
    api.getSuggestedQueries().then(setSuggestions).catch(() => {});
    // Welcome message
    setMessages([{
      role: 'assistant',
      content: `🚔 **Welcome to SCRB AI Investigator**\n\nI'm your intelligent crime analytics assistant for Karnataka Police. I can help you:\n\n- 🔍 Query crime records across 31 districts\n- 📊 Analyze trends and patterns\n- 🕵️ Profile criminal networks\n- 🔮 Generate predictive insights\n- 🗣️ Answer in **English** or **ಕನ್ನಡ**\n\nType your question below or use a suggested query to get started!`,
      insights: ['Connected to SCRB database with 50,000+ crime records', 'AI powered by Gemini 2.5 Flash', 'All queries are logged for audit trail'],
      timestamp: new Date().toISOString(),
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadSession = async (sessionId: number) => {
    setActiveSession(sessionId);
    const data = await api.getMessages(sessionId);
    setMessages(data.messages.map((m: any) => ({
      id: m.id, role: m.role, content: m.content,
      sql_query: m.sql_query, timestamp: m.timestamp, language: m.language,
    })));
  };

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date().toISOString() }]);
    setLoading(true);
    try {
      const res = await api.sendMessage(msg, activeSession || undefined, lang);
      if (!activeSession) {
        setActiveSession(res.session_id);
        api.getSessions().then(setSessions);
      }
      setMessages(prev => [...prev, {
        role: 'assistant', content: res.answer,
        sql_query: res.sql_query, insights: res.insights,
        timestamp: res.timestamp, language: res.language,
        result_count: res.result_count,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Failed to get response. Please try again.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser. Try Chrome.'); return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = lang === 'kn' ? 'kn-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsRecording(false);
      // Auto-submit voice query
      setTimeout(() => sendMessage(transcript), 100);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('SCRB Crime Intelligence - Chat Export', 20, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Exported by: ${user?.full_name || 'User'} | ${new Date().toLocaleString()}`, 20, 30);
    let y = 45;
    messages.forEach(m => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(m.role === 'user' ? 80 : 60, m.role === 'user' ? 80 : 130, m.role === 'user' ? 200 : 80);
      doc.text(m.role === 'user' ? '▶ YOU:' : '🤖 AI:', 20, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(m.content.replace(/\*\*/g, '').replace(/[🔴📊📈🔍]/g, ''), 170);
      lines.forEach((line: string) => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(line, 25, y); y += 6;
      });
      y += 4;
    });
    doc.save(`SCRB_Chat_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const formatContent = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  const newSession = () => {
    setActiveSession(null);
    setMessages([{
      role: 'assistant',
      content: lang === 'kn'
        ? '🔍 **ಹೊಸ ತನಿಖೆ ಪ್ರಾರಂಭವಾಗಿದೆ**\n\nನೀವು ೆನು ತನಿಖೆ ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?'
        : '🔍 **New Investigation Started**\n\nWhat would you like to investigate?',
      timestamp: new Date().toISOString(),
    }]);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh' }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <span className="page-icon">🤖</span>
          AI Investigator
          <span style={{ fontSize:12, color:'var(--success)', fontWeight:500, padding:'3px 10px', background:'rgba(34,197,94,0.1)', borderRadius:99, border:'1px solid rgba(34,197,94,0.2)' }}>
            ● Live
          </span>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div className="lang-toggle">
            <button className={`lang-btn ${lang==='en'?'active':''}`} onClick={() => setLang('en')}>EN</button>
            <button className={`lang-btn ${lang==='kn'?'active':''}`} onClick={() => setLang('kn')}>ಕನ್ನಡ</button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={exportPDF}>📄 Export PDF</button>
          <button className="btn btn-primary btn-sm" onClick={newSession}>+ New Chat</button>
        </div>
      </div>

      <div className="chat-layout">
        {/* Session Sidebar */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
              Investigation Sessions
            </div>
          </div>
          <div className="chat-sessions">
            <div className={`chat-session-item ${!activeSession ? 'active' : ''}`} onClick={newSession}>
              <div className="session-title">+ New Investigation</div>
            </div>
            {sessions && sessions.map(s => (
              <div key={s.id} className={`chat-session-item ${activeSession === s.id ? 'active' : ''}`}
                onClick={() => loadSession(s.id)}>
                <div className="session-title">{s.title}</div>
                <div className="session-time">
                  {new Date(s.created_at).toLocaleDateString()} · {s.message_count} msgs
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat */}
        <div className="chat-main">
          <div className="chat-messages" id="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`message-row ${m.role} fade-in`}>
                <div className={`message-avatar ${m.role}`}>
                  {m.role === 'user' ? (user?.full_name?.[0] || '👤') : '🤖'}
                </div>
                <div style={{ flex:1 }}>
                  <div className={`message-bubble ${m.role}`}>
                    <div dangerouslySetInnerHTML={{ __html: formatContent(m.content) }} />
                    {m.insights && m.insights.length > 0 && (
                      <div className="message-insights">
                        {m.insights.map((ins, j) => (
                          <div key={j} className="insight-item">
                            <div className="insight-dot" />
                            <span>{ins}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.sql_query && (
                      <div style={{ marginTop:10 }}>
                        <button onClick={() => setShowSql(showSql === i ? null : i)}
                          style={{ fontSize:11, color:'var(--accent-light)', background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:6, cursor:'pointer', padding:'3px 10px', display:'flex', alignItems:'center', gap:6 }}>
                          🔍 {showSql === i ? 'Hide' : 'Show'} AI Reasoning
                          {m.result_count !== undefined && <span style={{ color:'var(--text-muted)', fontSize:10 }}>· {m.result_count} rows</span>}
                        </button>
                        {showSql === i && (
                          <div style={{ marginTop:8, background:'rgba(0,0,0,0.4)', borderRadius:10, border:'1px solid rgba(99,102,241,0.15)', overflow:'hidden' }}>
                            {/* XAI Step 1: Language */}
                            <div style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', gap:8, alignItems:'center' }}>
                              <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' }}>Step 1 — Language Detected</span>
                              <span style={{ fontSize:11, padding:'1px 8px', borderRadius:99, background:'rgba(34,197,94,0.15)', color:'var(--success)', fontWeight:600 }}>
                                {m.language === 'kn' ? '🇮🇳 ಕನ್ನಡ' : '🇬🇧 English'}
                              </span>
                            </div>
                            {/* XAI Step 2: SQL */}
                            <div style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6 }}>Step 2 — SQL Generated by Gemini</div>
                              <pre style={{ margin:0, fontSize:11, color:'#a5f3fc', fontFamily:'JetBrains Mono, monospace', overflow:'auto', whiteSpace:'pre-wrap', lineHeight:1.5 }}>{m.sql_query}</pre>
                            </div>
                            {/* XAI Step 3: Results */}
                            {m.result_count !== undefined && (
                              <div style={{ padding:'8px 12px', display:'flex', gap:8, alignItems:'center' }}>
                                <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' }}>Step 3 — Database Response</span>
                                <span style={{ fontSize:11, padding:'1px 8px', borderRadius:99, background:'rgba(99,102,241,0.15)', color:'var(--accent-light)', fontWeight:600 }}>{m.result_count} rows returned</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="message-time">
                    {m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : ''}
                    {m.language === 'kn' && ' · ಕನ್ನಡ'}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="message-row assistant fade-in">
                <div className="message-avatar assistant">🤖</div>
                <div className="message-bubble assistant">
                  <div className="typing-indicator">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <span style={{ marginLeft:8, fontSize:12, color:'var(--text-muted)' }}>
                      {lang === 'kn' ? 'ಮಾಹಿತಿ ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ...' : 'Analyzing crime data...'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="chat-input-area">
            {/* Suggestions */}
            <div className="suggested-queries">
              {suggestions[lang]?.slice(0, 4).map((q, i) => (
                <button key={i} className="suggested-query" onClick={() => sendMessage(q)}>
                  {q.length > 45 ? q.slice(0,45) + '...' : q}
                </button>
              ))}
            </div>
            <div className="chat-input-row">
              <div className="chat-input-wrapper">
                <textarea
                  ref={textareaRef}
                  id="chat-input"
                  className="chat-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={lang === 'kn' ? 'ಅಪರಾಧ ಮಾಹಿತಿ ಕೇಳಿ...' : 'Ask about crime data, trends, suspects...'}
                  rows={1}
                  disabled={loading}
                />
                <button className={`voice-btn ${isRecording ? 'recording' : ''}`} onClick={startVoice} title="Voice input">
                  {isRecording ? '⏹' : '🎤'}
                </button>
              </div>
              <button id="send-message" className="send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
                ➤
              </button>
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:8, textAlign:'center' }}>
              Powered by Gemini 2.5 Flash · All queries audited · Press Shift+Enter for new line
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
