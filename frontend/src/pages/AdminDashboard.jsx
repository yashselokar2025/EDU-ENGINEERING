import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useToast } from '../context/ToastContext';

const API = 'http://localhost:8000/api';
const WS = 'ws://localhost:8000/ws/admin';

const SIDEBAR_ITEMS = [
  { label: 'Overview', items: [
    { id: 'overview', icon: '📊', label: 'Dashboard' },
    { id: 'realtime', icon: '🔴', label: 'Live Monitor' },
  ]},
  { label: 'Department', items: [
    { id: 'teachers', icon: '👨‍🏫', label: 'Teachers' },
    { id: 'labs', icon: '🔬', label: 'Labs & Reports' },
    { id: 'students', icon: '🎓', label: 'Students' },
  ]},
  { label: 'Management', items: [
    { id: 'add_user', icon: '➕', label: 'Add User' },
    { id: 'certificates', icon: '🏆', label: 'Certificates' },
    { id: 'leaderboard', icon: '🥇', label: 'Leaderboard' },
  ]},
];

function StatCard({ icon, value, label, color = '#818cf8' }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function LiveStatusDot({ status }) {
  const isAvailable = status?.includes('Available') || status?.includes('✅');
  const isLeave = status?.includes('Leave') || status?.includes('🏖');
  const isTeaching = status?.includes('Teaching') || status?.includes('🎓');
  if (isTeaching) return <span className="badge badge-yellow">🎓 Teaching</span>;
  if (isLeave) return <span className="badge badge-red">🏖 On Leave</span>;
  if (isAvailable) return <span className="badge badge-green">✅ Available</span>;
  return <span className="badge badge-blue">{status || 'Unknown'}</span>;
}

// ── OVERVIEW ────────────────────────────────────────────────────────────────
function Overview({ stats, events }) {
  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>Welcome, <span className="gradient-text">HOD Dashboard</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>Department Monitoring & Information System — G.H. Raisoni College</p>
      </div>

      <div className="stat-grid" style={{ marginBottom: '2rem' }}>
        <StatCard icon="👨‍🏫" value={stats.teachers} label="Teachers" color="#818cf8" />
        <StatCard icon="🎓" value={stats.students} label="Students" color="#f472b6" />
        <StatCard icon="🔬" value={stats.labs} label="Labs" color="#fbbf24" />
        <StatCard icon="📋" value={stats.lab_reports} label="Lab Reports" color="#34d399" />
        <StatCard icon="⚠️" value={stats.open_issues} label="Open Issues" color="#f87171" />
        <StatCard icon="🏆" value={stats.certificates} label="Certs Issued" color="#60a5fa" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📡</span> Real-Time Activity
            <span className="live-dot" style={{ marginLeft: 'auto' }}></span>
          </h3>
          {events.length === 0 ?
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No recent activity. Waiting for updates...</p>
            : events.slice(0, 6).map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '1.1rem', marginTop: '0.1rem' }}>{ev.icon}</div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{ev.message}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ev.time}</div>
                </div>
              </div>
            ))
          }
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>🏛️ About Edu-Engineering</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.7 }}>
            Edu-Engineering streamlines academic administration.
            Track teacher availability in real-time, manage lab equipment reports, monitor
            student performance, and issue blockchain-verified certificates — all in one place.
          </p>
          <div className="divider" />
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {['Real-Time Tracking', 'Lab Reports', 'DSA Arena', 'Blockchain Certs', 'Anti-Cheat'].map(tag => (
              <span key={tag} className="chip">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TEACHER MANAGEMENT ───────────────────────────────────────────────────────
function TeacherManagement({ teachers, onBroadcast }) {
  const [search, setSearch] = useState('');
  const filtered = teachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase())
  );

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>👨‍🏫 Teacher <span className="gradient-text">Management</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>Real-time availability and schedule overview</p>
      </div>
      <input className="input" placeholder="🔍 Search teachers..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: '1.5rem', maxWidth: 360 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filtered.map(t => (
          <div key={t.id} className="teacher-card">
            <div className="teacher-avatar" style={{ background: `linear-gradient(135deg, #6366f1, #8b5cf6)` }}>
              {t.name.charAt(0)}
            </div>
            <div className="teacher-info">
              <div className="teacher-name">{t.name}</div>
              <div className="teacher-meta">ID: {t.id} &nbsp;·&nbsp; {t.today_classes?.length || 0} classes today</div>
              {t.today_classes?.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                  {t.today_classes.map((c, ci) => (
                    <span key={ci} className="chip">{c.slot}: {c.subject} @ {c.room}</span>
                  ))}
                </div>
              )}
            </div>
            <LiveStatusDot status={t.status} />
          </div>
        ))}
        {filtered.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No teachers found.</p>}
      </div>
    </div>
  );
}

// ── LAB MANAGEMENT ───────────────────────────────────────────────────────────
function LabManagement({ labs, onResolve }) {
  const [selectedLab, setSelectedLab] = useState(null);
  const [reports, setReports] = useState([]);
  const toast = useToast();

  const loadReports = async (labId) => {
    setSelectedLab(labId);
    const res = await fetch(`${API}/dmis/lab/${labId}/reports`);
    const data = await res.json();
    setReports(data);
  };

  const handleResolve = async (reportId) => {
    await fetch(`${API}/dmis/lab/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: reportId })
    });
    toast('Report marked as resolved ✅', 'success');
    loadReports(selectedLab);
    onResolve();
  };

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>🔬 Lab <span className="gradient-text">Equipment Reports</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>Monitor defective equipment across all laboratories</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {labs.map(lab => (
          <div key={lab.id} className="card" onClick={() => loadReports(lab.id)}
            style={{ cursor: 'pointer', borderColor: selectedLab === lab.id ? 'rgba(99,102,241,0.5)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔬</div>
                <h3>{lab.name}</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>ID: {lab.id}</p>
              </div>
              {lab.open_issues > 0 && <span className="badge badge-red">⚠️ {lab.open_issues} open</span>}
            </div>
            <div className="divider" />
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
              <span>📋 {lab.total_reports} reports</span>
              <span style={{ color: '#f87171' }}>🔧 {lab.total_issues} total issues</span>
              <span style={{ color: '#34d399', marginLeft: 'auto' }}>✅ {lab.resolved} resolved</span>
            </div>
          </div>
        ))}
      </div>

      {selectedLab && (
        <>
          <h2 style={{ marginBottom: '1rem' }}>Reports for {selectedLab}</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Monitors</th>
                  <th>CPU</th>
                  <th>Mouse</th>
                  <th>Keyboard</th>
                  <th>Switches</th>
                  <th>Total Issues</th>
                  <th>Other</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.timestamp}</td>
                    <td>{r.monitors}</td>
                    <td>{r.cpu}</td>
                    <td>{r.mouse}</td>
                    <td>{r.keyboard}</td>
                    <td>{r.switches}</td>
                    <td><span className={`badge ${r.total > 0 ? 'badge-red' : 'badge-green'}`}>{r.total}</span></td>
                    <td style={{ fontSize: '0.8rem', maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.other_issues || '—'}</td>
                    <td><span className={`badge ${r.resolved ? 'badge-green' : 'badge-yellow'}`}>{r.resolved ? 'Resolved' : 'Pending'}</span></td>
                    <td>
                      {!r.resolved && (
                        <button className="btn btn-success btn-sm" onClick={() => handleResolve(r.id)}>Resolve</button>
                      )}
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No reports yet</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── ADD USER ─────────────────────────────────────────────────────────────────
function AddUser({ onAdd }) {
  const [form, setForm] = useState({ user_id: '', name: '', role: 'student', password: '' });
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/auth/add_user`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message, 'success');
        setForm({ user_id: '', name: '', role: 'student', password: '' });
        onAdd();
      } else {
        toast(data.detail, 'error');
      }
    } catch {
      toast('Failed to add user', 'error');
    }
  };

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>➕ Add <span className="gradient-text">User</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>Register teachers, lab incharges, and students</p>
      </div>
      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>User ID</label>
            <input className="input" value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} placeholder="e.g. GH, lab501, stu10" required />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Full Name</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" required />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Role</label>
            <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Admin / HOD</option>
              <option value="teacher">Teacher</option>
              <option value="lab">Lab Incharge</option>
              <option value="student">Student</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Initial Password</label>
            <input className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Set initial password" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>➕ Add User to System</button>
        </form>
      </div>
    </div>
  );
}

// ── LEADERBOARD ──────────────────────────────────────────────────────────────
function Leaderboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(`${API}/edu/leaderboard`).then(r => r.json()).then(setData);
  }, []);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>🥇 Student <span className="gradient-text">Leaderboard</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>Top performing students by YG Token earnings</p>
      </div>
      <div className="card">
        {data.length === 0
          ? <p style={{ color: 'var(--text-muted)' }}>No data yet. Students earn YG tokens by solving DSA problems!</p>
          : data.map((entry, i) => (
            <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem', borderRadius: 12, background: i === 0 ? 'rgba(251,191,36,0.06)' : 'transparent', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '1.5rem', width: 32, textAlign: 'center' }}>{medals[i] || `#${i + 1}`}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{entry.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🏅 {entry.badges} badges</div>
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: '1.2rem', color: '#fbbf24' }}>⚡ {entry.yg} YG</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── MAIN ADMIN DASHBOARD ─────────────────────────────────────────────────────
export default function AdminDashboard({ user, onLogout }) {
  const [active, setActive] = useState('overview');
  const [stats, setStats] = useState({ teachers: 0, students: 0, labs: 0, certificates: 0, lab_reports: 0, open_issues: 0 });
  const [teachers, setTeachers] = useState([]);
  const [labs, setLabs] = useState([]);
  const [events, setEvents] = useState([]);
  const toast = useToast();

  const fetchStats = () => fetch(`${API}/admin/stats`).then(r => r.json()).then(setStats).catch(() => {});
  const fetchTeachers = () => fetch(`${API}/dmis/teachers`).then(r => r.json()).then(setTeachers).catch(() => {});
  const fetchLabs = () => fetch(`${API}/dmis/labs`).then(r => r.json()).then(setLabs).catch(() => {});

  useEffect(() => {
    fetchStats(); fetchTeachers(); fetchLabs();

    // WebSocket for live updates
    try {
      const ws = new WebSocket(WS);
      ws.onmessage = ev => {
        const data = JSON.parse(ev.data);
        const time = new Date().toLocaleTimeString();
        if (data.type === 'TEACHER_UPDATE') {
          fetchTeachers();
          setEvents(p => [{ icon: '👨‍🏫', message: `Teacher status updated: ${data.status}`, time }, ...p.slice(0, 19)]);
        } else if (data.type === 'LAB_REPORT') {
          fetchLabs(); fetchStats();
          setEvents(p => [{ icon: '🔬', message: `New lab report from ${data.lab_id} — ${data.total_issues} issues`, time }, ...p.slice(0, 19)]);
        } else if (data.type === 'REPORT_RESOLVED') {
          fetchLabs(); fetchStats();
          setEvents(p => [{ icon: '✅', message: `Report #${data.report_id} resolved`, time }, ...p.slice(0, 19)]);
        } else if (data.type === 'YG_EARNED') {
          setEvents(p => [{ icon: '⚡', message: `${data.student_id} earned ${data.amount} YG tokens!`, time }, ...p.slice(0, 19)]);
        }
      };
      ws.onerror = () => {};
      return () => ws.close();
    } catch {}
  }, []);

  const sidebarItems = SIDEBAR_ITEMS.map(g => ({
    ...g,
    items: g.items.map(item => ({
      ...item,
      badge: item.id === 'labs' && stats.open_issues > 0 ? stats.open_issues : undefined
    }))
  }));

  const render = () => {
    switch (active) {
      case 'overview': return <Overview stats={stats} events={events} />;
      case 'teachers':
      case 'realtime': return <TeacherManagement teachers={teachers} onBroadcast={() => {}} />;
      case 'labs': return <LabManagement labs={labs} onResolve={fetchStats} />;
      case 'add_user': return <AddUser onAdd={() => { fetchStats(); fetchTeachers(); fetchLabs(); }} />;
      case 'leaderboard': return <Leaderboard />;
      case 'students': return (
        <div className="fade-up">
          <div className="page-header"><h1>🎓 <span className="gradient-text">Students</span></h1></div>
          <p style={{ color: 'var(--text-muted)' }}>View leaderboard for student performance data.</p>
          <Leaderboard />
        </div>
      );
      case 'certificates': return (
        <div className="fade-up">
          <div className="page-header"><h1>🏆 <span className="gradient-text">Certificates</span></h1></div>
          <div className="card" style={{ maxWidth: 480 }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Issue blockchain-verified certificates to students who complete courses or DSA challenges.</p>
            <IssueCert />
          </div>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="layout">
      <Sidebar
        items={sidebarItems}
        activeItem={active}
        setActiveItem={setActive}
        userInfo={{ icon: '🏛️', name: user.name, role: 'Admin / HOD' }}
      />
      <div className="main-content">{render()}</div>
    </div>
  );
}

function IssueCert() {
  const [form, setForm] = useState({ student_name: '', course_name: '', cert_type: 'Course Completion' });
  const [result, setResult] = useState(null);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API}/edu/certificate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setResult(data);
    toast('Certificate issued on blockchain! 🏆', 'success');
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <input className="input" placeholder="Student ID (e.g. stu1)" value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })} required />
      <input className="input" placeholder="Course Name (e.g. Data Structures)" value={form.course_name} onChange={e => setForm({ ...form, course_name: e.target.value })} required />
      <select className="input" value={form.cert_type} onChange={e => setForm({ ...form, cert_type: e.target.value })}>
        <option>Course Completion</option>
        <option>DSA Mastery</option>
        <option>Excellence Award</option>
        <option>Internship Completion</option>
      </select>
      <button type="submit" className="btn btn-primary">Issue Certificate 🏆</button>
      {result && (
        <div className="alert alert-success">
          ✅ Certificate issued! UID: <strong>{result.uid}</strong>
          <br /><span style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>Hash: {result.hash?.substring(0, 32)}...</span>
        </div>
      )}
    </form>
  );
}
