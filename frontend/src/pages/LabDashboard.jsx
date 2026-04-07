import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useToast } from '../context/ToastContext';

const API = 'http://localhost:8000/api';
const WS = 'ws://localhost:8000/ws/lab';

const ITEMS = [
  { label: '', items: [
    { id: 'dashboard', icon: '📊', label: 'Lab Overview' },
    { id: 'report', icon: '📝', label: 'Submit Report' },
    { id: 'history', icon: '📋', label: 'Report History' },
  ]},
];

const EQUIPMENT = [
  { key: 'monitors', label: 'Monitors', icon: '🖥️' },
  { key: 'cpu', label: 'CPU / PC', icon: '💻' },
  { key: 'mouse', label: 'Mouse', icon: '🖱️' },
  { key: 'keyboard', label: 'Keyboard', icon: '⌨️' },
  { key: 'switches', label: 'Switches/Hubs', icon: '🔌' },
];

function Counter({ value, onChange }) {
  return (
    <div className="repair-counter">
      <button className="counter-btn" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
      <span className="counter-val">{value}</span>
      <button className="counter-btn" onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

export default function LabDashboard({ user, onLogout }) {
  const [active, setActive] = useState('dashboard');
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({ total_reports: 0, open_issues: 0, resolved: 0, total_issues: 0 });
  const toast = useToast();

  const fetchReports = async () => {
    try {
      const res = await fetch(`${API}/dmis/lab/${user.id}/reports`);
      const data = await res.json();
      setReports(data);
      const open = data.filter(r => !r.resolved).reduce((s, r) => s + r.total, 0);
      const resolved = data.filter(r => r.resolved).reduce((s, r) => s + r.total, 0);
      const total = open + resolved;
      setSummary({ total_reports: data.length, open_issues: open, resolved, total_issues: total });
    } catch {}
  };

  useEffect(() => {
    fetchReports();
    try {
      const ws = new WebSocket(WS);
      ws.onmessage = ev => {
        const data = JSON.parse(ev.data);
        if (data.type === 'REPORT_RESOLVED') fetchReports();
      };
      ws.onerror = () => {};
      return () => ws.close();
    } catch {}
  }, []);

  const render = () => {
    switch (active) {
      case 'dashboard': return <LabOverview user={user} summary={summary} reports={reports} />;
      case 'report': return <SubmitReport user={user} onSubmit={fetchReports} />;
      case 'history': return <ReportHistory reports={reports} />;
      default: return null;
    }
  };

  const sidebarItems = ITEMS.map(g => ({
    ...g, items: g.items.map(i => ({
      ...i,
      badge: i.id === 'report' && summary.open_issues > 0 ? summary.open_issues : undefined
    }))
  }));

  return (
    <div className="layout">
      <Sidebar items={sidebarItems} activeItem={active} setActiveItem={setActive}
        userInfo={{ icon: '🔬', name: user.name, role: 'Lab Incharge' }} />
      <div className="main-content">{render()}</div>
    </div>
  );
}

function LabOverview({ user, summary, reports }) {
  const recent = reports.slice(0, 5);
  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>🔬 <span className="gradient-text">{user.name}</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>Lab Equipment Monitoring & Reporting Dashboard</p>
      </div>

      <div className="stat-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-value" style={{ color: '#818cf8' }}>{summary.total_reports}</div>
          <div className="stat-label">Total Reports</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-value" style={{ color: '#f87171' }}>{summary.open_issues}</div>
          <div className="stat-label">Open Issues</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-value" style={{ color: '#34d399' }}>{summary.resolved}</div>
          <div className="stat-label">Issues Resolved</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔧</div>
          <div className="stat-value" style={{ color: '#fbbf24' }}>{summary.total_issues}</div>
          <div className="stat-label">Total Equipment Issues</div>
        </div>
      </div>

      {summary.open_issues > 0 && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          ⚠️ You have <strong>{summary.open_issues}</strong> unresolved equipment issues. The HOD has been notified via real-time dashboard.
        </div>
      )}

      <h2 style={{ marginBottom: '1rem' }}>📋 Recent Submissions</h2>
      <div className="card">
        {recent.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
            No reports submitted yet. Use "Submit Report" to log equipment issues.
          </div>
        ) : recent.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem', background: 'rgba(255,255,255,0.02)', borderRadius: 12, marginBottom: '0.5rem', border: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.timestamp}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                🖥️ {r.monitors} &nbsp; 💻 {r.cpu} &nbsp; 🖱️ {r.mouse} &nbsp; ⌨️ {r.keyboard} &nbsp; 🔌 {r.switches}
              </div>
              {r.other_issues && <div style={{ color: '#fbbf24', fontSize: '0.8rem', marginTop: '0.2rem' }}>Note: {r.other_issues}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: '1.3rem', color: r.total > 0 ? '#f87171' : '#34d399' }}>{r.total}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total</div>
            </div>
            <span className={`badge ${r.resolved ? 'badge-green' : 'badge-yellow'}`} style={{ flexShrink: 0 }}>
              {r.resolved ? '✅ Resolved' : '⏳ Pending'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubmitReport({ user, onSubmit }) {
  const [form, setForm] = useState({ monitors: 0, cpu: 0, mouse: 0, keyboard: 0, switches: 0, other_issues: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const toast = useToast();

  const total = form.monitors + form.cpu + form.mouse + form.keyboard + form.switches;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/dmis/lab/${user.id}/report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      toast('Report submitted! Admin notified instantly 🔔', 'success');
      setSuccess(true);
      setForm({ monitors: 0, cpu: 0, mouse: 0, keyboard: 0, switches: 0, other_issues: '' });
      setTimeout(() => setSuccess(false), 3000);
      onSubmit();
    } catch { toast('Failed to submit report', 'error'); }
    finally { setLoading(false); }
  };

  const setVal = (key, val) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>📝 Submit <span className="gradient-text">Equipment Report</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>Report defective or malfunctioning equipment — HOD is notified in real-time</p>
      </div>

      <div className="card" style={{ maxWidth: 680 }}>
        {success && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>✅ Report submitted successfully! Admin dashboard updated instantly.</div>}
        <form onSubmit={handleSubmit}>
          <h3 style={{ marginBottom: '0.5rem' }}>Equipment with Issues (0 = Working Fine)</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Enter the count of defective/broken items for each category:</p>

          <div className="repair-grid">
            {EQUIPMENT.map(eq => (
              <div key={eq.key} className="repair-item">
                <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>{eq.icon}</div>
                <label className="repair-label">{eq.label}</label>
                <Counter value={form[eq.key]} onChange={v => setVal(eq.key, v)} />
              </div>
            ))}
          </div>

          {/* Total preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: total > 0 ? 'rgba(248,113,113,0.08)' : 'rgba(52,211,153,0.08)', borderRadius: 12, border: `1px solid ${total > 0 ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)'}`, marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{total > 0 ? '⚠️' : '✅'}</span>
            <div>
              <div style={{ fontWeight: 700 }}>{total > 0 ? `${total} equipment issues reported` : 'All equipment working fine'}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>This will be logged and shown on admin dashboard</div>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Additional Notes (Optional)</label>
            <textarea className="input" rows={3} value={form.other_issues} onChange={e => setForm(p => ({ ...p, other_issues: e.target.value }))} placeholder="Describe any other issues, observations, or maintenance suggestions..." style={{ resize: 'vertical' }} />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? <span className="spin">⟳</span> : '📤'} {loading ? 'Submitting...' : 'Submit Report to Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ReportHistory({ reports }) {
  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>📋 Report <span className="gradient-text">History</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>All submitted lab equipment reports</p>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Date & Time</th><th>🖥️ Monitor</th><th>💻 CPU</th>
              <th>🖱️ Mouse</th><th>⌨️ Keyboard</th><th>🔌 Switches</th>
              <th>Total</th><th>Notes</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r, i) => (
              <tr key={r.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.timestamp}</td>
                <td><span style={{ color: r.monitors > 0 ? '#f87171' : '#34d399' }}>{r.monitors}</span></td>
                <td><span style={{ color: r.cpu > 0 ? '#f87171' : '#34d399' }}>{r.cpu}</span></td>
                <td><span style={{ color: r.mouse > 0 ? '#f87171' : '#34d399' }}>{r.mouse}</span></td>
                <td><span style={{ color: r.keyboard > 0 ? '#f87171' : '#34d399' }}>{r.keyboard}</span></td>
                <td><span style={{ color: r.switches > 0 ? '#f87171' : '#34d399' }}>{r.switches}</span></td>
                <td><span className={`badge ${r.total > 0 ? 'badge-red' : 'badge-green'}`}>{r.total}</span></td>
                <td style={{ fontSize: '0.8rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.other_issues || '—'}</td>
                <td><span className={`badge ${r.resolved ? 'badge-green' : 'badge-yellow'}`}>{r.resolved ? '✅' : '⏳'}</span></td>
              </tr>
            ))}
            {reports.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No reports submitted yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
