import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function Sidebar({ items, activeItem, setActiveItem, userInfo }) {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setMobileOpen(o => !o);
    window.addEventListener('toggle-mobile-menu', handleToggle);
    return () => window.removeEventListener('toggle-mobile-menu', handleToggle);
  }, []);

  const SidebarContent = () => (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* User mini profile */}
      <div style={{ padding: '0.75rem', marginBottom: '0.75rem', background: 'rgba(99,102,241,0.08)', borderRadius: 13, border: '1px solid rgba(99,102,241,0.14)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary-d), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
            {userInfo.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.83rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userInfo.name}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.05rem' }}>{userInfo.role}</div>
          </div>
        </div>
      </div>

      {items.map((group, gi) => (
        <div key={gi} className="sidebar-section">
          {group.label && <div className="sidebar-section-label">{group.label}</div>}
          {group.items.map(item => (
            <button key={item.id} onClick={() => { setActiveItem(item.id); setMobileOpen(false); }}
              className={`sidebar-item ${activeItem === item.id ? 'active' : ''}`}>
              <span className="sidebar-icon">{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && <span className="sidebar-badge">{item.badge}</span>}
            </button>
          ))}
        </div>
      ))}

      {/* Theme toggle at bottom */}
      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <button onClick={toggle} className="sidebar-item" style={{ width: '100%', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span className="sidebar-icon">{theme === 'dark' ? '🌙' : '☀️'}</span>
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          <div className="theme-toggle" onClick={(e) => { e.stopPropagation(); toggle(); }}>
            <div className="theme-toggle-knob">{theme === 'dark' ? '🌙' : '☀️'}</div>
          </div>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <SidebarContent />
      {mobileOpen && <div className="mobile-overlay active" onClick={() => setMobileOpen(false)} />}
    </>
  );
}
