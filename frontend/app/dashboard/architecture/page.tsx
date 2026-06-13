'use client';
import { useState } from 'react';

const ARCHITECTURE_STEPS = [
  {
    title: '🌐 Modular Next.js Frontend',
    desc: 'Pre-rendered pages with Leaflet GIS mapping, dynamic criminal network graphs (react-force-graph), and real-time state tracking.',
    icon: '💻'
  },
  {
    title: '⚡ Asynchronous FastAPI Backend',
    desc: 'Asynchronous event loop for concurrent analytics. Implements clean architecture routing, token authentication, and background task scheduling.',
    icon: '⚙️'
  },
  {
    title: '🧠 Cached ML Predictive Engine',
    desc: 'Scikit-learn models (Ridge, GB, Isolation Forest) serialized to disk. Fast inference reads predictions from binary pickle files in <5ms.',
    icon: '🔮'
  },
  {
    title: '📂 Optimized SQLite Database',
    desc: 'Relational SQLite storage with custom indices on searchable columns (fir_number, district, year), ready for migration to Zoho Data Store or PostgreSQL.',
    icon: '🗄️'
  },
  {
    title: '🤖 Self-Correcting LLM SQL Agent',
    desc: 'Catches raw database syntax exceptions, builds structural feedback context, and loops up to 3 times to heal generated query structures.',
    icon: '🧠'
  }
];

const QA_ITEMS = [
  {
    q: 'Data Availability: Will participants get access to actual KSP crime data?',
    a: 'No, KSP does not provide raw sensitive data to prevent security exposure. However, our system utilizes realistic mock database templates representing actual CCTNS formats (crimes, suspects, and police stations) allowing full functional validation.'
  },
  {
    q: 'Data Provisioning: In terms of datasets, will anything be provided to the participants?',
    a: 'Basic CCTNS data schemas were outlined. Our seed engine (`seed_data.py`) generates highly realistic, structured historical series (2018–2024) containing crime severity categories, coordinates, and offender linkage structures.'
  },
  {
    q: 'Existing Tools & Pain Points: Can we use existing tools? What are the limitations and intended use of the proposed solutions?',
    a: 'While CCTNS aggregates cases, it lacks automated early-warning alerts, network analysis, and predictive capabilities. Our platform bridges these gaps by adding proactive ML early warnings and AI-assisted investigation workflows.'
  },
  {
    q: 'Investigation Workflow: What is the typical journey of an investigation from FIR to closure?',
    a: 'An investigation moves through: Filed ➔ Under Investigation ➔ Chargesheeted ➔ Trial Stage ➔ Closed/Disposed. Our visual Stepper in Case Intelligence automates this, tracking checklist completion for every stage dynamically.'
  },
  {
    q: 'Mapping/Prediction: Does the department want a mapping system for time and location?',
    a: 'Yes! Our map page implements a live toggle between historical density mapping and predictive hotspots, allowing district commanders to map where future crimes are forecasted to rise.'
  },
  {
    q: 'Predictive Analytics Scope: Should predictive analytics focus purely on case management or deep networks?',
    a: 'Both are expected. Our predictions route handles case alerts and future spikes, while the criminal network page runs MODularity-based community clustering to map out multi-district gang kingpins and brokers.'
  },
  {
    q: 'Agentic AI / LLMs on Zoho Catalyst: Can we run LLM/AI assistance on Zoho Catalyst?',
    a: 'Yes. By packaging the Python backend as Zoho Catalyst Functions and using client-side async fetch, LLM services can integrate easily while complying with serverless execution boundaries.'
  },
  {
    q: 'Architecture/Scale: Are there recommended architectures for the solution?',
    a: 'Yes, solutions must handle large volumes across many police stations. We achieve this through model serialization cache (O(1) lookups taking <5ms), asynchronous request handling, and index-optimized query structures.'
  },
  {
    q: 'Real-time Responsiveness: Do we have to make an immediately responsive AI?',
    a: 'Yes, alerts must be proactive. Our system runs a Live Early Warning Feed that evaluates threat thresholds and pushes real-time immediate-urgency notifications to district commanders.'
  }
];

export default function ArchitecturePage() {
  const [activeTab, setActiveTab] = useState<'architecture' | 'qa'>('architecture');

  return (
    <div>
      <div className="page-header">
        <div className="page-title"><span className="page-icon">📚</span>Architecture & Datathon Q&A</div>
        <div style={{ display: 'flex', background: 'var(--bg-glass)', borderRadius: 8, border: '1px solid var(--border)' }}>
          {(['architecture', 'qa'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{
                padding: '6px 16px', fontSize: 12, fontWeight: 600,
                background: activeTab === t ? 'var(--accent)' : 'none',
                color: activeTab === t ? '#fff' : 'var(--text-muted)',
                border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s'
              }}>
              {t === 'architecture' ? '⚙️ System Architecture' : '❓ Datathon Q&A'}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content" style={{ padding: 16 }}>
        {activeTab === 'architecture' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
            {/* Left Panel - Architecture flow */}
            <div>
              <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
                <div className="chart-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>⚙️</span> Scalable High-Performance Architecture
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                  To support thousands of concurrent queries across Karnataka's police stations, the system completely segregates
                  heavy model training from operational queries. Prediction results are precomputed and cached on disk, reducing
                  endpoint response times to milliseconds.
                </p>

                {/* Vertical Stepper Flow */}
                <div style={{ position: 'relative', paddingLeft: 24 }}>
                  <div style={{ position: 'absolute', left: 10, top: 10, bottom: 10, width: 2, background: 'rgba(99,102,241,0.2)' }} />
                  {ARCHITECTURE_STEPS.map((step, idx) => (
                    <div key={idx} style={{ marginBottom: 20, position: 'relative' }}>
                      <div style={{
                        position: 'absolute', left: -20, top: 4, width: 10, height: 10, borderRadius: '50%',
                        background: 'var(--accent-light)', boxShadow: '0 0 8px var(--accent-light)'
                      }} />
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 20 }}>{step.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>{step.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step.desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Flow Diagram card */}
              <div className="glass-card" style={{ padding: 24 }}>
                <div className="chart-title" style={{ marginBottom: 12 }}>🔄 Data Flow Pipeline</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center', fontSize: 12 }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent-light)' }}>1. Ingestion & Seed</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                      FIR Filed ➔ Background Retrain Triggered ➔ database updated.
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--warning)' }}>2. Model Cache</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Background Task trains models ➔ serializes output to `models/*.pkl`.
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--success)' }}>3. Active Inference</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Inference loads `.pkl` ➔ renders GIS Hotspots & Early Warnings in &lt;5ms.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Zoho Catalyst Deployment Details */}
            <div>
              <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
                <div className="chart-title" style={{ color: 'var(--text-gold)', marginBottom: 10 }}>⚡ Zoho Catalyst Compatibility</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Our platform's stateless service design maps perfectly to the **Zoho Catalyst Serverless Platform**:
                  <ul style={{ paddingLeft: 16, marginTop: 8 }}>
                    <li style={{ marginBottom: 6 }}>
                      <strong>Advanced Functions</strong>: FastAPI routes can run inside Python-based Catalyst functions.
                    </li>
                    <li style={{ marginBottom: 6 }}>
                      <strong>Data Store</strong>: The SQLite relational schema can migrate to Catalyst PostgreSQL Data Store.
                    </li>
                    <li style={{ marginBottom: 6 }}>
                      <strong>Web Client Hosting</strong>: The Next.js frontend deploys to Catalyst Web Hosting with CDN delivery.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="glass-card" style={{ padding: 20 }}>
                <div className="chart-title" style={{ marginBottom: 10 }}>🔒 Security & Auditing</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  All SQL generation is sanitized through parameter bindings. Every query generated by our agent is logged under the
                  **Audit Trail** including the requesting officer username, timestamp, and results returned.
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Q&A Tab */
          <div className="glass-card" style={{ padding: 24 }}>
            <div className="chart-title" style={{ marginBottom: 16 }}>❓ Datathon 2026 Q&A Insights</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              The following highlights our implementation choices for the questions raised by participants during the datathon Q&A session.
            </p>

            <div style={{ display: 'grid', gap: 16 }}>
              {QA_ITEMS.map((item, idx) => (
                <div key={idx} style={{ paddingBottom: 16, borderBottom: idx < QA_ITEMS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent-light)', marginBottom: 6 }}>
                    Q: {item.q}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {item.a}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
