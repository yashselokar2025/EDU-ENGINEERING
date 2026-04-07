import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

const API = 'http://localhost:8000/api';

const ROLES = [
  { id: 'admin', label: 'Admin / HOD', icon: '🏛️', color: 'var(--primary)' },
  { id: 'teacher', label: 'Teacher', icon: '👨‍🏫', color: 'var(--accent)' },
  { id: 'lab', label: 'Lab Incharge', icon: '🔬', color: 'var(--warning)' },
  { id: 'student', label: 'Student', icon: '🎓', color: 'var(--secondary)' },
];

const DEMO_CREDS = {
  admin: { id: 'admin1', pwd: 'admin123' },
  teacher: { id: 'AB', pwd: 'Yash@123' },
  lab: { id: 'lab408', pwd: 'Ashish@123' },
  student: { id: 'stu1', pwd: 'stu123' },
};

export default function LoginPage({ setUser }) {
  const [selectedRole, setSelectedRole] = useState('student');
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const creds = DEMO_CREDS[selectedRole];
    setUserid(creds.id);
    setPassword(creds.pwd);
    setError('');
  }, [selectedRole]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userid, password }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        toast(`Welcome back, ${data.name}! 👋`, 'success');
        const routes = { admin: '/admin', teacher: '/teacher', lab: '/lab', student: '/student' };
        navigate(routes[data.role] || '/student');
      } else setError('Invalid credentials. Please try again.');
    } catch {
      setError('Cannot connect to server. Make sure FastAPI is running.');
    } finally { setLoading(false); }
  };

  const role = ROLES.find(r => r.id === selectedRole);

  return (
    <div className="login-page">
      <div className="login-wrap fade-up">
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, var(--primary-d), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 0 25px var(--pri-glow)' }}>🏛️</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: '1.6rem', lineHeight: 1.1 }}>
                <span className="gradient-text">Edu-Engineering</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Academic Platform</div>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>G.H. Raisoni College of Engineering</p>
        </div>

        <div className="login-card">
          <div style={{ marginBottom: '1.5rem' }}>
            <p className="label" style={{ marginBottom: '0.75rem' }}>Login As</p>
            <div className="role-grid">
              {ROLES.map(r => (
                <button key={r.id} type="button" onClick={() => setSelectedRole(r.id)} className={`role-btn ${selectedRole === r.id ? 'active' : ''}`}>
                  <span className="role-icon">{r.icon}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label">User ID (Demo)</label>
              <input className="input" value={userid} onChange={e => setUserid(e.target.value)} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label">Password (Demo)</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? <span className="spin">⟳</span> : role?.icon} {loading ? 'Signing in...' : `Login as ${role?.label}`}
            </button>
          </form>

          <div className="creds-box">
            <p className="label" style={{ fontSize: '0.65rem', marginBottom: '0.2rem' }}>Demo Credentials</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', margin: 0 }}>
              <strong style={{ color: role?.color }}>{role?.label}:</strong> {DEMO_CREDS[selectedRole]?.id} / {DEMO_CREDS[selectedRole]?.pwd}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
