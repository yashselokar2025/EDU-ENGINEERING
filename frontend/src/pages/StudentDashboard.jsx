import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { useToast } from '../context/ToastContext';

const API = 'http://localhost:8000/api';
const WS_URL = 'ws://localhost:8000/ws/student';

const SIDEBAR_ITEMS = [
  { label: 'Learning', items: [
    { id: 'teachers',    icon: '👨‍🏫', label: 'Faculty Status' },
    { id: 'dsa',         icon: '⚔️',  label: 'DSA Arena' },
    { id: 'resume',      icon: '📄',  label: 'Resume Analyzer' },
    { id: 'interview',   icon: '🎤',  label: 'AI Interview' },
  ]},
  { label: 'Portfolio', items: [
    { id: 'portfolio',   icon: '🏆',  label: 'My Portfolio' },
    { id: 'leaderboard', icon: '🥇',  label: 'Leaderboard' },
  ]},
];

export default function StudentDashboard({ user }) {
  const [active, setActive]       = useState('teachers');
  const [teachers, setTeachers]   = useState([]);
  const [atsResult, setAtsResult] = useState(null);  // shared between Resume & Interview
  const toast = useToast();

  const fetchTeachers = () =>
    fetch(`${API}/dmis/teachers`).then(r => r.json()).then(setTeachers).catch(() => {});

  useEffect(() => {
    fetchTeachers();
    try {
      const ws = new WebSocket(WS_URL);
      ws.onmessage = ev => {
        const d = JSON.parse(ev.data);
        if (d.type === 'TEACHER_UPDATE') fetchTeachers();
        if (d.type === 'YG_EARNED' && d.student_id === user.id)
          toast(`⚡ +${d.amount} YG Tokens earned!`, 'success');
      };
      ws.onerror = () => {};
      return () => ws.close();
    } catch {}
  }, []);

  const render = () => {
    switch (active) {
      case 'teachers':    return <FacultyStatus teachers={teachers} />;
      case 'dsa':         return <DSAArena user={user} />;
      case 'resume':      return <ResumeAnalyzer user={user} onResult={setAtsResult} />;
      case 'interview':   return <InterviewMode user={user} atsResult={atsResult} />;
      case 'portfolio':   return <Portfolio user={user} />;
      case 'leaderboard': return <LeaderboardView />;
      default:            return null;
    }
  };

  return (
    <div className="layout">
      <Sidebar items={SIDEBAR_ITEMS} activeItem={active} setActiveItem={setActive}
        userInfo={{ icon: '🎓', name: user.name, role: 'Student' }} />
      <div className="main-content">{render()}</div>
    </div>
  );
}

// ── FACULTY STATUS ────────────────────────────────────────────────────────────
function FacultyStatus({ teachers }) {
  const [search, setSearch] = useState('');
  const filtered = teachers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>👨‍🏫 Faculty <span className="gradient-text">Availability</span></h1>
        <p>Live teacher status — updates in real-time <span className="live-dot" style={{ verticalAlign: 'middle', marginLeft: 6 }} /></p>
      </div>

      <input className="input" placeholder="🔍 Search faculty by name..." value={search}
        onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360, marginBottom: '1.5rem' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        {filtered.map(t => {
          const isAvail    = t.status?.includes('✅');
          const isTeaching = t.status?.includes('🎓');
          const isLeave    = t.status?.includes('🏖');
          const isNot      = t.status?.includes('❌');
          return (
            <div key={t.id} className="user-row">
              <div className="user-avatar">{t.name.charAt(0)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  {t.today_classes?.length > 0 ? `${t.today_classes.length} class(es) today` : 'No classes today'}
                </div>
                {t.today_classes?.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                    {t.today_classes.map((c, ci) => (
                      <span key={ci} className="chip" style={{ fontSize: '0.7rem' }}>{c.slot}: {c.subject} @ {c.room}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {isAvail    && <span className="badge badge-green">✅ Available</span>}
                {isTeaching && <span className="badge badge-yellow" style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.status}</span>}
                {isLeave    && <span className="badge badge-red">🏖 On Leave</span>}
                {isNot      && <span className="badge badge-red">❌ Not Available</span>}
                {!isAvail && !isTeaching && !isLeave && !isNot && <span className="badge badge-blue">{t.status || '—'}</span>}
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>Updated: {t.last_updated}</div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No faculty found.</p>}
      </div>
    </div>
  );
}

// ── DSA ARENA ─────────────────────────────────────────────────────────────────
function DSAArena({ user }) {
  const [questions, setQuestions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filter, setFilter]       = useState('all');
  const [activeQ, setActiveQ]     = useState(null);
  const [code, setCode]           = useState('# Write your Python solution here\n\n');
  const [tab, setTab]             = useState('problem');
  const [termLines, setTermLines] = useState([]);
  const [running, setRunning]     = useState(false);
  const [solved, setSolved]       = useState(new Set());
  const toast = useToast();

  useEffect(() => {
    fetch(`${API}/dsa/companies`).then(r => r.json()).then(d => setCompanies(d.companies));
    loadQ('all');
  }, []);

  const loadQ = (f) => {
    let url = `${API}/dsa/questions`;
    if (!['all','easy','medium','hard'].includes(f)) url += `?company=${encodeURIComponent(f)}`;
    else if (f !== 'all') url += `?difficulty=${f}`;
    fetch(url).then(r => r.json()).then(d => {
      setQuestions(d.questions);
      if (d.questions.length > 0) selectQ(d.questions[0]);
    });
    setFilter(f);
  };

  const selectQ = (q) => {
    setActiveQ(q);
    setCode(`# Problem: ${q.title}\n# ${q.description}\n# Expected output: ${q.expected}\n\n`);
    setTermLines([{ type: 't-info', text: `⚔️ Loaded: "${q.title}" [${q.difficulty?.toUpperCase()}]` }]);
    setTab('problem');
  };

  const runCode = async () => {
    if (!activeQ) return;
    setRunning(true); setTab('output');
    setTermLines(p => [...p, { type: 't-normal', text: '$ Executing code...' }]);
    try {
      const res = await fetch(`${API}/dsa/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, expected: activeQ.expected, student_id: user.id, question_id: activeQ.id })
      });
      const d = await res.json();
      if (d.result === 'Passed') {
        setSolved(p => new Set(p).add(activeQ.id));
        setTermLines(p => [...p,
          { type: 't-success', text: `✅ PASSED! Your output: "${d.output}"` },
          { type: 't-success', text: `⚡ +10 YG Tokens awarded!` },
        ]);
        toast('🎉 Correct! +10 YG Tokens earned!', 'success');
      } else if (d.result === 'Failed') {
        setTermLines(p => [...p,
          { type: 't-error', text: `❌ Wrong answer. Your output: "${d.output}"` },
          { type: 't-warn',  text: `   Expected: "${d.expected}"` },
          { type: 't-info',  text: `💡 Check spacing, newlines and print format.` },
        ]);
      } else {
        setTermLines(p => [...p, { type: 't-error', text: `💥 Error: ${d.stderr}` }]);
      }
    } catch {
      setTermLines(p => [...p, { type: 't-error', text: '⚠️ Cannot reach server.' }]);
    } finally { setRunning(false); }
  };

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>⚔️ DSA <span className="gradient-text">Arena</span></h1>
        <p>Practice coding · Earn YG tokens · Beat company questions</p>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '1.1rem', alignItems: 'center' }}>
        {['all','easy','medium','hard'].map(f => (
          <button key={f} onClick={() => loadQ(f)} className={`btn btn-sm ${filter===f?'btn-primary':'btn-secondary'}`}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 0.2rem' }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, alignSelf: 'center' }}>🏢</span>
        {companies.map(c => (
          <button key={c} onClick={() => loadQ(c)} className={`btn btn-sm ${filter===c?'btn-primary':'btn-secondary'}`}>{c}</button>
        ))}
      </div>

      <div className="dsa-layout">
        {/* Question list */}
        <div className="dsa-sidebar">
          <div className="dsa-sidebar-head">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{questions.length} Problems</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 700 }}>✅ {solved.size} Solved</span>
            </div>
          </div>
          <div className="dsa-list">
            {questions.map((q, i) => (
              <div key={q.id} className={`dsa-item ${activeQ?.id===q.id?'active':''}`} onClick={() => selectQ(q)}>
                <div className="dsa-item-title">
                  {solved.has(q.id) ? '✅ ' : `${i+1}. `}{q.title}
                </div>
                <div className="dsa-item-meta">
                  <span className={`diff-${q.difficulty}`}>{q.difficulty}</span>
                  {q.companies?.slice(0,2).map(c=>(
                    <span key={c} style={{ fontSize:'0.68rem', color:'var(--text-muted)', background:'var(--bg-elevated)', padding:'0.1rem 0.4rem', borderRadius:4 }}>{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        {activeQ ? (
          <div className="editor-pane">
            <div className="editor-header">
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {['problem','output'].map(t => (
                  <div key={t} className={`editor-tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
                    {t==='problem'?'📖 Problem':'⬛ Console'}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Python 3</span>
                <button className="btn btn-sm btn-secondary" onClick={() => setCode(`# Problem: ${activeQ.title}\n# ${activeQ.description}\n\n`)}>Reset</button>
                <button className="btn btn-sm btn-primary" onClick={runCode} disabled={running}>
                  {running ? <span className="spin">⟳</span> : '▶'} {running?'Running...':'Run Code'}
                </button>
              </div>
            </div>

            {/* Problem description (tab=problem) */}
            {tab === 'problem' && (
              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: 'var(--code-bg)', color: 'var(--code-text)' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.15rem' }}>{activeQ.title}</h2>
                  <span className={`diff-${activeQ.difficulty}`}>{activeQ.difficulty}</span>
                  {solved.has(activeQ.id) && <span className="badge badge-green">✅ Solved</span>}
                </div>
                <p style={{ lineHeight: 1.75, color: '#8b949e', marginBottom: '1.25rem' }}>{activeQ.description}</p>
                <div style={{ background: 'var(--code-header)', borderRadius: 10, padding: '1rem', border: '1px solid var(--code-border)', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Expected Output</div>
                  <code style={{ color: '#3fb950', fontFamily: 'JetBrains Mono, monospace' }}>{activeQ.expected}</code>
                </div>
                {activeQ.companies?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Asked by</div>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                      {activeQ.companies.map(c => <span key={c} className="chip">{c}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Code textarea (always shown below problem, full on output tab) */}
            <div style={{ flex: tab==='problem' ? '0 0 220px' : 1, display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--code-border)' }}>
              {tab==='problem' && (
                <div style={{ padding: '0.45rem 1rem', background: 'var(--code-header)', borderBottom: '1px solid var(--code-border)', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>solution.py</span><span>{code.split('\n').length} lines</span>
                </div>
              )}
              <textarea className="code-area"
                value={code} onChange={e => setCode(e.target.value)}
                spellCheck={false}
                onKeyDown={e => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const s = e.target.selectionStart;
                    const newCode = code.substring(0,s)+'    '+code.substring(e.target.selectionEnd);
                    setCode(newCode);
                    setTimeout(() => e.target.setSelectionRange(s+4,s+4), 0);
                  }
                }}
              />
            </div>

            {/* Console output */}
            <div className="terminal" style={{ display: tab==='output' ? undefined : 'none' }}>
              {termLines.map((l,i) => <div key={i} className={l.type}>{l.text}</div>)}
              {termLines.length === 0 && <div className="t-normal">Run your code to see output here...</div>}
            </div>

            <div className="editor-footer">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                <span>⚡ +10 YG per solve</span>
                <span style={{ display: 'none' }}>·</span>
                <span style={{ display: 'none' }}>Tab = 4 spaces</span>
              </div>
              <button className="btn btn-primary" onClick={runCode} disabled={running}>
                {running ? <span className="spin">⟳</span> : '▶'} Submit
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--code-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem' }}>⚔️</div>
            <div>Select a problem to start coding</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── RESUME ANALYZER (with file upload + ATS) ──────────────────────────────────
function ResumeAnalyzer({ user, onResult }) {
  const [file, setFile]         = useState(null);
  const [textFallback, setTextFallback] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [activeQ, setActiveQ]   = useState(null);
  const [code, setCode]         = useState('');
  const [termLines, setTermLines] = useState([]);
  const inputRef = useRef();
  const toast = useToast();

  const analyze = async () => {
    if (!file && !textFallback.trim()) { toast('Please upload a resume or paste text!', 'error'); return; }
    setLoading(true);
    try {
      let data;
      if (file) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${API}/resume/upload`, { method: 'POST', body: form });
        data = await res.json();
      } else {
        const res = await fetch(`${API}/resume/analyze_text`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textFallback })
        });
        data = await res.json();
      }
      setResult(data);
      onResult(data);   // share with interview mode
      if (data.questions?.length > 0) { setActiveQ(data.questions[0]); setCode(`# ${data.questions[0].question}\n\n`); }
      toast('ATS analysis complete! 🎯', 'success');
    } catch { toast('Analysis failed. Make sure backend is running.', 'error'); }
    finally   { setLoading(false); }
  };

  const runCheck = async () => {
    if (!activeQ) return;
    const res = await fetch(`${API}/dsa/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, expected: activeQ.expected, student_id: user.id })
    });
    const d = await res.json();
    if (d.result === 'Passed') {
      setTermLines(p => [...p, { type: 't-success', text: `✅ Correct! Output: "${d.output}" — +10 YG!` }]);
      toast('Correct! +10 YG 🎉', 'success');
    } else {
      setTermLines(p => [...p,
        { type: 't-error', text: `❌ Wrong. Got: "${d.output}"` },
        { type: 't-warn',  text: `   Expected: "${d.expected}"` },
        { type: 't-info',  text: `💡 Hint: ${activeQ.hint || 'Review the problem.'}` },
      ]);
    }
  };

  const atsColor = s => s >= 70 ? 'ats-fill-high' : s >= 40 ? 'ats-fill-medium' : 'ats-fill-low';

  if (result) return (
    <div className="fade-up">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1>📄 ATS <span className="gradient-text">Scan Results</span></h1>
            <p>{result.message}</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setResult(null)}>↩ Re-upload</button>
          </div>
        </div>
      </div>

      {/* ATS Score */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card card-no-hover" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', fontWeight: 900, fontFamily: 'Space Grotesk', color: result.ats_score >= 70 ? 'var(--accent)' : result.ats_score >= 40 ? 'var(--warning)' : 'var(--danger)' }}>
            {result.ats_score}%
          </div>
          <div className="ats-bar" style={{ margin: '0.75rem 0' }}>
            <div className={`ats-fill ${atsColor(result.ats_score)}`} style={{ width: `${result.ats_score}%` }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>ATS Score</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {result.ats_score >= 70 ? 'Strong resume! ✅' : result.ats_score >= 40 ? 'Needs improvement ⚡' : 'Low ATS match ⚠️'}
          </div>
        </div>

        <div className="card card-no-hover">
          <div style={{ fontWeight: 800, marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✅ Found Skills</div>
          <div>
            {result.ats_keywords_found?.map(k => (
              <span key={k} className="keyword-tag chip-skill">{k}</span>
            ))}
            {!result.ats_keywords_found?.length && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None detected</span>}
          </div>
        </div>

        <div className="card card-no-hover">
          <div style={{ fontWeight: 800, marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>❌ Missing Keywords</div>
          <div>
            {result.ats_keywords_missing?.map(k => (
              <span key={k} className="keyword-tag chip-missing">{k}</span>
            ))}
            {!result.ats_keywords_missing?.length && <span style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>Excellent coverage! 🎉</span>}
          </div>
        </div>
      </div>

      {/* Practice questions */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', height: 'calc(100vh - 380px)', minHeight: 400 }}>
        <div className="card card-no-hover" style={{ padding: '0.875rem', overflow: 'auto' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
            Interview Questions ({result.questions?.length})
          </div>
          {result.questions?.map((q, i) => (
            <div key={i} className={`dsa-item ${activeQ===q?'active':''}`} onClick={() => { setActiveQ(q); setCode(`# Q${i+1}: ${q.question}\n\n`); setTermLines([]); }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Q{i+1}: {q.question.substring(0,42)}...</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Expected: <code>{q.expected}</code></div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--code-bg)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--code-border)' }}>
          <div style={{ padding: '0.875rem 1.1rem', background: 'var(--code-header)', borderBottom: '1px solid var(--code-border)' }}>
            <div style={{ fontWeight: 700, color: 'var(--code-text)', fontSize: '0.9rem' }}>{activeQ?.question}</div>
            <div style={{ fontSize: '0.78rem', color: '#8b949e', marginTop: '0.3rem' }}>Expected: <code style={{ color: '#3fb950' }}>{activeQ?.expected}</code></div>
            {activeQ?.hint && <div style={{ fontSize: '0.75rem', color: '#e3b341', marginTop: '0.3rem' }}>💡 Hint available after submission</div>}
          </div>
          <textarea className="code-area" style={{ flex: 1 }} value={code} onChange={e => setCode(e.target.value)} spellCheck={false} />
          <div className="terminal" style={{ maxHeight: 120 }}>
            {termLines.map((l,i) => <div key={i} className={l.type}>{l.text}</div>)}
            {termLines.length === 0 && <div className="t-normal">Run code to see output...</div>}
          </div>
          <div style={{ padding: '0.75rem 1.1rem', background: 'var(--code-header)', borderTop: '1px solid var(--code-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>💡 Solve questions from your skillset</span>
            <button className="btn btn-primary btn-sm" onClick={runCheck}>▶ Run & Check</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>📄 Resume <span className="gradient-text">ATS Analyzer</span></h1>
        <p>Upload your PDF/DOCX resume — get ATS score + personalized interview questions</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', maxWidth: 900 }}>
        {/* Upload Zone */}
        <div>
          <div className={`dropzone ${dragging ? 'dragging' : ''}`}
            onDragEnter={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if(f) setFile(f); }}>
            <input ref={inputRef} type="file" accept=".pdf,.docx,.doc,.txt"
              onChange={e => setFile(e.target.files[0])} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
            <div className="dropzone-icon">{file ? '📄' : '☁️'}</div>
            <div className="dropzone-text">{file ? file.name : 'Drop resume here or click to browse'}</div>
            <div className="dropzone-hint">PDF, DOCX, DOC, TXT supported</div>
            {file && (
              <button className="btn btn-danger btn-sm" style={{ marginTop: '0.75rem' }}
                onClick={e => { e.stopPropagation(); setFile(null); }}>✕ Remove</button>
            )}
          </div>

          <div style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>— or —</div>

          <div>
            <label className="label">Paste Resume Text / Skills</label>
            <textarea className="input" rows={6} value={textFallback} onChange={e => setTextFallback(e.target.value)}
              placeholder="e.g. Python, React, Machine Learning, Data Structures, SQL..."
              style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
          </div>

          <button className="btn btn-primary btn-lg btn-full" style={{ marginTop: '1rem' }}
            onClick={analyze} disabled={loading}>
            {loading ? <span className="spin">⟳</span> : '🧠'} {loading ? 'Scanning...' : 'Scan Resume & Get Questions'}
          </button>
        </div>

        {/* How it works */}
        <div className="card card-no-hover">
          <h3 style={{ marginBottom: '1.25rem' }}>🎯 How It Works</h3>
          {[
            { icon: '📤', title: 'Upload Resume', desc: 'Upload your PDF/DOCX or paste text' },
            { icon: '🔍', title: 'ATS Keyword Scan', desc: 'AI scans 50+ tech keywords: Python, Java, React, ML, SQL, DSA...' },
            { icon: '📊', title: 'Get ATS Score', desc: 'See your ATS compatibility score + missing keywords to add' },
            { icon: '🎤', title: 'Personalized Questions', desc: 'Get 6 coding questions matched exactly to your skills' },
            { icon: '⚡', title: 'Earn YG Tokens', desc: 'Solve them in the built-in code editor and earn YG tokens!' },
            { icon: '🎓', title: 'Start AI Interview', desc: 'Go to AI Interview tab for proctored mock interview session' },
          ].map(s => (
            <div key={s.title} style={{ display: 'flex', gap: '0.875rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '1.4rem', flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{s.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AI INTERVIEW MODE ─────────────────────────────────────────────────────────
function InterviewMode({ user, atsResult }) {
  const [started, setStarted]   = useState(false);
  const [qIndex, setQIndex]     = useState(0);
  const [answers, setAnswers]   = useState([]);
  const [code, setCode]         = useState('');
  const [termLines, setTermLines] = useState([]);
  const [timer, setTimer]       = useState(0);
  const [cheatAlert, setCheatAlert] = useState('');
  const [webcamOn, setWebcamOn] = useState(false);
  const [done, setDone]         = useState(false);
  const videoRef = useRef();
  const streamRef = useRef();
  const timerRef = useRef();
  const toast = useToast();

  const questions = atsResult?.questions || [
    { question: "Print 'Hello, World!'", expected: "Hello, World!",  hint: "print('Hello, World!')" },
    { question: "Print factorial of 5.", expected: "120",            hint: "import math\nprint(math.factorial(5))" },
    { question: "Reverse 'python'.",     expected: "nohtyp",        hint: "print('python'[::-1])" },
  ];

  const startInterview = async () => {
    setStarted(true);
    setTimer(0); setQIndex(0); setAnswers([]); setDone(false);
    setCode(`# Q1: ${questions[0]?.question}\n\n`);
    setTermLines([{ type: 't-info', text: '🎤 Interview started. Good luck!' }]);
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);

    // start webcam
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setWebcamOn(true);
      // tab visibility anti-cheat
      document.addEventListener('visibilitychange', handleTabSwitch);
    } catch { toast('Webcam not available. Interview continues without proctoring.', 'info'); }
  };

  const handleTabSwitch = () => {
    if (document.hidden) {
      setCheatAlert('⚠️ Tab Switch Detected!');
      setTimeout(() => setCheatAlert(''), 3000);
    }
  };

  const stopInterview = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    document.removeEventListener('visibilitychange', handleTabSwitch);
    setStarted(false); setWebcamOn(false);
  };

  const submitAnswer = async () => {
    const expected = questions[qIndex]?.expected || '';
    const res = await fetch(`${API}/dsa/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, expected, student_id: user.id })
    });
    const d = await res.json();
    const passed = d.result === 'Passed';
    setAnswers(p => [...p, { q: questions[qIndex].question, passed, output: d.output }]);
    setTermLines(p => [...p,
      { type: passed ? 't-success' : 't-error', text: passed ? `✅ Q${qIndex+1} Correct!` : `❌ Q${qIndex+1} Wrong — expected: "${expected}", got: "${d.output}"` }
    ]);

    if (qIndex + 1 >= questions.length) {
      // Done
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      document.removeEventListener('visibilitychange', handleTabSwitch);
      setDone(true);
    } else {
      const next = qIndex + 1;
      setQIndex(next);
      setCode(`# Q${next+1}: ${questions[next]?.question}\n\n`);
    }
  };

  const formatTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  if (!started && !done) return (
    <div className="fade-up">
      <div className="page-header">
        <h1>🎤 AI <span className="gradient-text">Interview Mode</span></h1>
        <p>Proctored mock interview — webcam monitoring, timer, real coding questions</p>
      </div>

      {!atsResult && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
          💡 For personalized questions, <strong>analyze your resume first</strong> via the Resume Analyzer tab. Otherwise, general questions will be used.
        </div>
      )}
      {atsResult && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
          ✅ Resume analyzed! Interview will use <strong>{questions.length} personalized questions</strong> based on your skills: {atsResult.detected_skills?.join(', ')}.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { icon: '📹', title: 'Webcam Proctoring', desc: 'Webcam enabled for anti-cheating' },
          { icon: '⏱️', title: 'Timed Interview', desc: 'Full session timer visible' },
          { icon: '🚨', title: 'Tab Switch Alert', desc: 'Tab switching is detected' },
          { icon: '💻', title: 'Live Coding', desc: 'Code and run answers in-browser' },
        ].map(f => (
          <div key={f.title} className="card card-no-hover" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{f.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary btn-xl" onClick={startInterview}>
        🎤 Start Interview ({questions.length} Questions)
      </button>
    </div>
  );

  if (done) {
    const passed = answers.filter(a => a.passed).length;
    const pct = Math.round((passed / questions.length) * 100);
    return (
      <div className="fade-up">
        <div className="page-header">
          <h1>🏁 Interview <span className="gradient-text">Complete!</span></h1>
        </div>
        <div className="card card-no-hover" style={{ maxWidth: 560, marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>
            {pct >= 70 ? '🏆' : pct >= 50 ? '👍' : '💪'}
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 900, fontFamily: 'Space Grotesk', color: pct >= 70 ? 'var(--accent)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
            {pct}%
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '0.5rem' }}>
            {passed}/{questions.length} Correct · Time: {formatTime(timer)}
          </div>
          <div style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {pct >= 70 ? 'Excellent! You\'re interview ready.' : pct >= 50 ? 'Good attempt! Keep practicing.' : 'Keep practicing in DSA Arena!'}
          </div>
        </div>
        <div className="card card-no-hover" style={{ maxWidth: 560 }}>
          {answers.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', borderBottom: i < answers.length-1 ? '1px solid var(--border)' : 'none' }}>
              <span>{a.passed ? '✅' : '❌'}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Q{i+1}: {a.q.substring(0,50)}...</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Your output: "{a.output}"</div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => { setStarted(false); setDone(false); }}>Try Again</button>
      </div>
    );
  }

  // ── ACTIVE INTERVIEW ──
  return (
    <div className="interview-overlay">
      {/* Webcam pane */}
      <div className="interview-webcam-pane">
        <div style={{ padding: '0.875rem', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--code-border)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Candidate Monitor</div>
          <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.9rem', marginTop: '0.2rem' }}>{user.name}</div>
        </div>
        <div className="webcam-feed">
          {cheatAlert && <div className="cheat-alert">{cheatAlert}</div>}
          {webcamOn ? <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} /> : <span>📵</span>}
        </div>
        <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: '#8b949e' }}>Timer</span>
            <span className="interview-timer" style={{ color: timer > 300 ? '#f85149' : '#3fb950', background: 'rgba(255,255,255,0.05)', fontSize: '1rem', padding: '0.2rem 0.5rem', borderRadius: 6 }}>{formatTime(timer)}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#8b949e' }}>Q {qIndex+1} / {questions.length}</div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${((qIndex+1)/questions.length)*100}%` }} /></div>
          <button className="btn btn-danger btn-sm btn-full" style={{ marginTop: '0.5rem' }} onClick={stopInterview}>⏹ End Interview</button>
        </div>
      </div>

      {/* Main interview area */}
      <div className="interview-main">
        {/* Q progress dots */}
        <div className="q-progress">
          {questions.map((_, i) => (
            <div key={i} className={`q-dot ${i < qIndex ? 'done' : i === qIndex ? 'active' : 'pending'}`}>
              {i < qIndex ? '✓' : i+1}
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <span className="badge badge-purple" style={{ marginBottom: '0.5rem' }}>Question {qIndex+1} of {questions.length}</span>
          <h2 style={{ fontSize: '1.1rem', lineHeight: 1.5 }}>{questions[qIndex]?.question}</h2>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Expected output: <code style={{ color: 'var(--accent)' }}>{questions[qIndex]?.expected}</code>
          </div>
        </div>

        {/* Code editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--code-bg)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--code-border)', minHeight: 260 }}>
          <div style={{ padding: '0.6rem 1rem', background: 'var(--code-header)', borderBottom: '1px solid var(--code-border)', fontSize: '0.8rem', color: '#8b949e', display: 'flex', justifyContent: 'space-between' }}>
            <span>solution.py · Python 3</span>
            <span>{code.split('\n').length} lines</span>
          </div>
          <textarea className="code-area" style={{ flex: 1, minHeight: 180 }} value={code} onChange={e => setCode(e.target.value)} spellCheck={false}
            onKeyDown={e => { if(e.key==='Tab'){e.preventDefault();const s=e.target.selectionStart;const nc=code.substring(0,s)+'    '+code.substring(e.target.selectionEnd);setCode(nc);setTimeout(()=>e.target.setSelectionRange(s+4,s+4),0);} }} />
          <div className="terminal" style={{ maxHeight: 100 }}>
            {termLines.slice(-4).map((l,i) => <div key={i} className={l.type}>{l.text}</div>)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={submitAnswer}>
            {qIndex+1 < questions.length ? `▶ Submit Q${qIndex+1} & Next →` : '▶ Submit Final Answer 🏁'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PORTFOLIO ─────────────────────────────────────────────────────────────────
function Portfolio({ user }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${API}/edu/portfolio/${user.id}`).then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div style={{color:'var(--text-muted)', padding:'2rem'}}>Loading portfolio...</div>;

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>🏆 My <span className="gradient-text">Portfolio</span></h1>
        <p>Blockchain-verified achievements, YG token balance, and transaction history</p>
      </div>

      <div className="stat-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="stat-card"><div className="stat-icon">⚡</div><div className="stat-value" style={{color:'var(--warning)'}}>{data.yg_balance}</div><div className="stat-label">YG Tokens</div></div>
        <div className="stat-card"><div className="stat-icon">🏅</div><div className="stat-value" style={{color:'var(--primary)'}}>{data.badges.reduce((s,b)=>s+b.count,0)}</div><div className="stat-label">Badges Earned</div></div>
        <div className="stat-card"><div className="stat-icon">🏆</div><div className="stat-value" style={{color:'var(--accent)'}}>{data.certificates.length}</div><div className="stat-label">Certificates</div></div>
      </div>

      {data.badges.length > 0 && (
        <div className="card card-no-hover" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>🏅 Badges</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {data.badges.map(b => (
              <div key={b.name} style={{ padding:'0.6rem 1rem', background:'rgba(129,140,248,0.08)', border:'1px solid rgba(129,140,248,0.18)', borderRadius:12, display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <span style={{ fontSize:'1.2rem' }}>{b.name.split(' ')[0]}</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:'0.88rem' }}>{b.name.split(' ').slice(1).join(' ')}</div>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>×{b.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.certificates.length > 0 && (
        <div className="card card-no-hover" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>🏆 Blockchain Certificates</h3>
          {data.certificates.map(c => (
            <div key={c.uid} style={{ padding:'0.875rem', background:'rgba(52,211,153,0.04)', border:'1px solid rgba(52,211,153,0.14)', borderRadius:12, marginBottom:'0.5rem' }}>
              <div style={{ fontWeight:700 }}>{c.course} <span className="chip" style={{fontSize:'0.7rem'}}>{c.type}</span></div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'0.2rem' }}>UID: {c.uid} · {new Date(c.issued).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card card-no-hover">
        <h3 style={{ marginBottom: '1rem' }}>⚡ YG Token History</h3>
        {data.transactions.length === 0
          ? <p style={{color:'var(--text-muted)',fontSize:'0.9rem'}}>No transactions yet. Solve DSA problems to earn tokens!</p>
          : data.transactions.map((t,i) => (
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'0.6rem 0',borderBottom: i<data.transactions.length-1?'1px solid var(--border)':'none'}}>
              <div>
                <span style={{fontWeight:600,fontSize:'0.88rem'}}>{t.type.replace(/_/g,' ').toUpperCase()}</span>
                <div style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{new Date(t.time).toLocaleString()}</div>
              </div>
              <div style={{fontWeight:900,color:'var(--warning)',fontFamily:'Space Grotesk'}}>+{t.amount} YG</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────
function LeaderboardView() {
  const [data, setData] = useState([]);
  useEffect(() => { fetch(`${API}/edu/leaderboard`).then(r=>r.json()).then(setData).catch(()=>{}); }, []);
  const medals = ['🥇','🥈','🥉'];
  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>🥇 <span className="gradient-text">Leaderboard</span></h1>
        <p>Top students by YG Token earnings from DSA Arena</p>
      </div>
      <div className="card card-no-hover">
        {data.length === 0
          ? <p style={{color:'var(--text-muted)'}}>No data yet. Be the first to earn tokens!</p>
          : data.map((e,i) => (
            <div key={e.id} style={{display:'flex',alignItems:'center',gap:'1rem',padding:'0.875rem',borderRadius:13,background:i===0?'rgba(251,191,36,0.05)':i===1?'rgba(148,163,184,0.04)':i===2?'rgba(180,120,60,0.04)':'transparent',marginBottom:'0.4rem',border:i<3?'1px solid rgba(255,255,255,0.05)':'none'}}>
              <div style={{fontSize:'1.6rem',width:36,textAlign:'center'}}>{medals[i]||`#${i+1}`}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700}}>{e.name}</div>
                <div style={{fontSize:'0.8rem',color:'var(--text-muted)'}}>🏅 {e.badges} badges</div>
              </div>
              <div style={{fontFamily:'Space Grotesk',fontWeight:900,fontSize:'1.3rem',color:'var(--warning)'}}>⚡ {e.yg}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}
