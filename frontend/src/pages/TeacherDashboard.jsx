import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useToast } from '../context/ToastContext';

const API = 'http://localhost:8000/api';
const WS = 'ws://localhost:8000/ws/teacher';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = ['08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00', '16:00-17:00'];

const SIDEBAR_ITEMS = [
  { label: '', items: [
    { id: 'dashboard', icon: '📊', label: 'My Dashboard' },
    { id: 'status', icon: '🟢', label: 'Update Status' },
    { id: 'schedule', icon: '📅', label: 'My Schedule' },
    { id: 'students', icon: '👥', label: 'Student View' },
  ]},
];

export default function TeacherDashboard({ user, onLogout }) {
  const [active, setActive] = useState('dashboard');
  const [teacherData, setTeacherData] = useState(null);
  const [allTeachers, setAllTeachers] = useState([]);
  const toast = useToast();

  const fetchData = async () => {
    try {
      const res = await fetch(`${API}/dmis/teachers`);
      const data = await res.json();
      const me = data.find(t => t.id === user.id);
      setTeacherData(me);
      setAllTeachers(data);
    } catch {}
  };

  useEffect(() => {
    fetchData();
    try {
      const ws = new WebSocket(WS);
      ws.onmessage = ev => {
        const data = JSON.parse(ev.data);
        if (data.type === 'TEACHER_UPDATE' || data.type === 'SCHEDULE_UPDATE') fetchData();
      };
      ws.onerror = () => {};
      return () => ws.close();
    } catch {}
  }, []);

  const render = () => {
    switch (active) {
      case 'dashboard': return <MyDashboard user={user} teacherData={teacherData} />;
      case 'status': return <UpdateStatus user={user} teacherData={teacherData} onUpdate={fetchData} />;
      case 'schedule': return <MySchedule user={user} schedule={teacherData?.schedule || {}} onUpdate={fetchData} />;
      case 'students': return <StudentView allTeachers={allTeachers} />;
      default: return null;
    }
  };

  return (
    <div className="layout">
      <Sidebar
        items={SIDEBAR_ITEMS}
        activeItem={active}
        setActiveItem={setActive}
        userInfo={{ icon: '👨‍🏫', name: user.name, role: 'Teacher' }}
      />
      <div className="main-content">{render()}</div>
    </div>
  );
}

// ── MY DASHBOARD ─────────────────────────────────────────────────────────────
function MyDashboard({ user, teacherData }) {
  if (!teacherData) return <div style={{ color: 'var(--text-muted)' }}>Loading...</div>;

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayClasses = teacherData.today_classes || [];

  const isAvailable = teacherData.status?.includes('✅');
  const isTeaching = teacherData.status?.includes('🎓');
  const isLeave = teacherData.status?.includes('🏖');

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>👋 Welcome, <span className="gradient-text">{user.name}</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>{today} — Teacher Dashboard</p>
      </div>

      {/* Current Status Banner */}
      <div className="card" style={{
        borderColor: isTeaching ? 'rgba(251,191,36,0.4)' : isAvailable ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)',
        marginBottom: '2rem',
        background: isTeaching ? 'rgba(251,191,36,0.05)' : isAvailable ? 'rgba(52,211,153,0.05)' : 'rgba(248,113,113,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2.5rem' }}>{isTeaching ? '🎓' : isAvailable ? '✅' : isLeave ? '🏖' : '❓'}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{teacherData.status}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Last updated: {teacherData.last_updated}</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span className="live-dot"></span>
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      <h2 style={{ marginBottom: '1rem' }}>📅 Today's Classes ({today})</h2>
      {todayClasses.length === 0
        ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', opacity: 0.7 }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
            <p>No classes scheduled for today!</p>
          </div>
        )
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            {todayClasses.map((cls, i) => {
              const [start, end] = cls.slot.split('-');
              const now = new Date().toTimeString().substring(0, 5);
              const isActive = start <= now && now <= end;
              return (
                <div key={i} className="card-flat" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderColor: isActive ? 'rgba(251,191,36,0.5)' : undefined, background: isActive ? 'rgba(251,191,36,0.04)' : undefined }}>
                  <div style={{ width: 4, height: 52, borderRadius: 4, background: isActive ? '#fbbf24' : 'rgba(99,102,241,0.4)', flexShrink: 0 }}></div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{cls.subject}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{cls.slot} · Room {cls.room}</div>
                  </div>
                  {isActive && <span className="badge badge-yellow" style={{ marginLeft: 'auto' }}>🔴 Live Now</span>}
                </div>
              );
            })}
          </div>
        )
      }

      {/* Weekly Overview */}
      <h2 style={{ marginBottom: '1rem' }}>🗓️ Weekly Schedule Overview</h2>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              {DAYS.slice(0, 5).map(d => <th key={d}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map(slot => (
              <tr key={slot}>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{slot}</td>
                {DAYS.slice(0, 5).map(day => {
                  const cls = teacherData.schedule?.[day]?.[slot];
                  return (
                    <td key={day}>
                      {cls ? (
                        <div style={{ background: 'rgba(99,102,241,0.12)', borderRadius: 8, padding: '0.4rem 0.5rem', fontSize: '0.75rem', border: '1px solid rgba(99,102,241,0.2)' }}>
                          <div style={{ fontWeight: 700 }}>{cls.subject}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{cls.room}</div>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── UPDATE STATUS ─────────────────────────────────────────────────────────────
function UpdateStatus({ user, teacherData, onUpdate }) {
  const [status, setStatus] = useState('AVAILABLE');
  const [room, setRoom] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/dmis/teacher/status/${user.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, room, leave_date: leaveDate })
      });
      const data = await res.json();
      toast(`Status updated: ${data.status}`, 'success');
      onUpdate();
    } catch {
      toast('Failed to update status', 'error');
    } finally { setLoading(false); }
  };

  const options = [
    { key: 'AVAILABLE', icon: '✅', label: 'Available', desc: 'I am available for students', color: '#34d399' },
    { key: 'NOT AVAILABLE', icon: '❌', label: 'Not Available', desc: 'Busy — please do not disturb', color: '#f87171' },
    { key: 'ON LEAVE', icon: '🏖', label: 'On Leave', desc: 'I am on leave today/this week', color: '#fbbf24' },
  ];

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>🟢 Update <span className="gradient-text">Status</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>Your status is visible to HOD, admin, and all students in real-time</p>
      </div>

      {teacherData && (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          Current status: <strong>{teacherData.status}</strong> · Last updated: {teacherData.last_updated}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {options.map(o => (
          <div key={o.key} onClick={() => setStatus(o.key)} className="card" style={{ cursor: 'pointer', borderColor: status === o.key ? o.color : undefined, background: status === o.key ? `rgba(${o.color === '#34d399' ? '52,211,153' : o.color === '#f87171' ? '248,113,113' : '251,191,36'},0.06)` : undefined, textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{o.icon}</div>
            <div style={{ fontWeight: 700, color: status === o.key ? o.color : undefined }}>{o.label}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{o.desc}</div>
            {status === o.key && <div style={{ marginTop: '0.75rem' }}><span className="badge badge-green">Selected ✓</span></div>}
          </div>
        ))}
      </div>

      {status === 'AVAILABLE' && (
        <div className="card-flat" style={{ marginBottom: '1rem', maxWidth: 400 }}>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Room Number (optional)</label>
          <input className="input" value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. A101, Staff Room 2" />
        </div>
      )}

      {status === 'ON LEAVE' && (
        <div className="card-flat" style={{ marginBottom: '1rem', maxWidth: 400 }}>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Return Date</label>
          <input className="input" type="date" value={leaveDate} onChange={e => setLeaveDate(e.target.value)} />
        </div>
      )}

      <button className="btn btn-primary btn-lg" onClick={handleUpdate} disabled={loading}>
        {loading ? <span className="spin">⟳</span> : '🚀'} {loading ? 'Updating...' : 'Update My Status'}
      </button>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.75rem' }}>
        ⚡ This will instantly notify all connected users via WebSocket.
      </p>
    </div>
  );
}

// ── MY SCHEDULE ───────────────────────────────────────────────────────────────
function MySchedule({ user, schedule, onUpdate }) {
  const [form, setForm] = useState({ day: 'Monday', time_slot: '09:00-10:00', room: '', subject: '' });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API}/dmis/teacher/schedule/${user.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      toast('Schedule updated!', 'success');
      onUpdate();
    } catch { toast('Failed to update schedule', 'error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (day, slot) => {
    await fetch(`${API}/dmis/teacher/schedule/${user.id}/${day}/${encodeURIComponent(slot)}`, { method: 'DELETE' });
    toast('Slot deleted', 'info');
    onUpdate();
  };

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>📅 Manage <span className="gradient-text">Schedule</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>Add or remove class slots from your weekly timetable</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1.2rem' }}>➕ Add Class Slot</h3>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Day</label>
              <select className="input" value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Time Slot</label>
              <select className="input" value={form.time_slot} onChange={e => setForm({ ...form, time_slot: e.target.value })}>
                {TIME_SLOTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Room</label>
              <input className="input" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="e.g. A101, Lab 408" required />
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Subject</label>
              <input className="input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Data Structures, DBMS Lab" required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : '✅ Save Slot'}</button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📋 Current Schedule</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 480, overflowY: 'auto' }}>
            {DAYS.map(day => {
              const slots = schedule[day] || {};
              if (Object.keys(slots).length === 0) return null;
              return (
                <div key={day}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.5rem 0 0.3rem' }}>{day}</div>
                  {Object.entries(slots).map(([slot, info]) => (
                    <div key={slot} className="card-flat" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{info.subject || info}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{slot} · {info.room || ''}</div>
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(day, slot)}>✕</button>
                    </div>
                  ))}
                </div>
              );
            })}
            {Object.keys(schedule).length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No schedule set yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STUDENT VIEW (what students see) ─────────────────────────────────────────
function StudentView({ allTeachers }) {
  return (
    <div className="fade-up">
      <div className="page-header">
        <h1>👥 <span className="gradient-text">Student View</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>Preview what students see when looking up faculty availability</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {allTeachers.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', flexShrink: 0 }}>{t.name.charAt(0)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{t.name}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {t.today_classes?.length > 0 ? `${t.today_classes.length} classes today` : 'No classes today'}
              </div>
            </div>
            <div>
              {t.status?.includes('✅') && <span className="badge badge-green">✅ Available</span>}
              {t.status?.includes('🎓') && <span className="badge badge-yellow">{t.status}</span>}
              {t.status?.includes('🏖') && <span className="badge badge-red">🏖 On Leave</span>}
              {t.status?.includes('❌') && <span className="badge badge-red">❌ Not Available</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
