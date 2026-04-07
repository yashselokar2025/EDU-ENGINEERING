import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import LabDashboard from './pages/LabDashboard';
import StudentDashboard from './pages/StudentDashboard';

const ROLE_COLORS = { admin:'#818cf8', teacher:'#34d399', lab:'#fbbf24', student:'#f472b6' };
const ROLE_ICONS  = { admin:'🏛️', teacher:'👨‍🏫', lab:'🔬', student:'🎓' };

function Navbar({ user, onLogout, onHamburger }) {
  const { theme, toggle } = useTheme();
  if (!user) return null;
  return (
    <nav className="navbar">
      <div className="navbar-logo">
        {onHamburger && (
          <button className="hamburger" onClick={() => window.dispatchEvent(new Event('toggle-mobile-menu'))} aria-label="Menu" style={{marginRight:'0.25rem'}}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        )}
        <div className="logo-mark">🏛️</div>
        <div>
          <span style={{color:'var(--primary)'}}>Edu-Engineering</span>
          <span style={{color:'var(--text-muted)',fontSize:'0.68rem',display:'block',fontWeight:400,lineHeight:1}}>G.H. Raisoni College</span>
        </div>
      </div>

      <div className="navbar-right">
        {/* Theme toggle (desktop) */}
        <button onClick={toggle} className="theme-toggle" title="Toggle theme" style={{flexShrink:0}}>
          <div className="theme-toggle-knob">{theme==='dark'?'🌙':'☀️'}</div>
        </button>

        {/* User chip */}
        <div style={{display:'flex',alignItems:'center',gap:'0.6rem',padding:'0.4rem 0.75rem',background:'var(--bg-elevated)',borderRadius:11,border:'1px solid var(--border)'}}>
          <span style={{fontSize:'1rem'}}>{ROLE_ICONS[user.role]}</span>
          <div style={{display:'flex',flexDirection:'column',gap:0}}>
            <span style={{fontWeight:700,fontSize:'0.83rem',lineHeight:1.2}}>{user.name}</span>
            <span style={{fontSize:'0.68rem',color:ROLE_COLORS[user.role],fontWeight:700,lineHeight:1.2}}>
              {user.role.charAt(0).toUpperCase()+user.role.slice(1)}
            </span>
          </div>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={onLogout}>Logout</button>
      </div>
    </nav>
  );
}

function ProtectedRoute({ user, role, element }) {
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;
  return element;
}

function AppInner() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('dmis_user')); } catch { return null; }
  });

  const setUserPersist = (u) => {
    setUser(u);
    if (u) sessionStorage.setItem('dmis_user', JSON.stringify(u));
    else    sessionStorage.removeItem('dmis_user');
  };

  const logout = () => { setUserPersist(null); window.location.href = '/'; };

  return (
    <BrowserRouter>
      <Navbar user={user} onLogout={logout} onHamburger={() => window.dispatchEvent(new Event('toggle-mobile-menu'))} />
      <Routes>
        <Route path="/" element={user ? <Navigate to={`/${user.role}`} replace /> : <LoginPage setUser={setUserPersist} />} />
        <Route path="/admin"   element={<ProtectedRoute user={user} role="admin"   element={<AdminDashboard   user={user} onLogout={logout} />} />} />
        <Route path="/teacher" element={<ProtectedRoute user={user} role="teacher" element={<TeacherDashboard user={user} onLogout={logout} />} />} />
        <Route path="/lab"     element={<ProtectedRoute user={user} role="lab"     element={<LabDashboard     user={user} onLogout={logout} />} />} />
        <Route path="/student" element={<ProtectedRoute user={user} role="student" element={<StudentDashboard user={user} onLogout={logout} />} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </ThemeProvider>
  );
}
