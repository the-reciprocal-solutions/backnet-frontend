import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV = [
  {
    section: 'OVERVIEW',
    items: [
      { path: '/',            label: 'Dashboard',      icon: '⊞' },
      { path: '/predictions', label: 'Predictive AI',  icon: '🔮' },
      { path: '/alarms',  label: 'Alarms',          icon: '🔔' },
      { path: '/events',  label: 'Event Log',       icon: '📋' },
    ],
  },
  {
    section: 'DISCOVERY',
    items: [
      { path: '/devices',   label: 'Devices',         icon: '🖧' },
      { path: '/discovery', label: 'Discovery',       icon: '🛰' },
      { path: '/objects',   label: 'Object Explorer', icon: '⊡' },
    ],
  },
  {
    section: 'MONITORING',
    items: [
      { path: '/livepoints', label: 'Live Points',  icon: '◉' },
      { path: '/trends',     label: 'Trends',       icon: '〰' },
      { path: '/schedules',  label: 'Schedules',    icon: '📅' },
    ],
  },
  {
    section: 'ANALYTICS',
    items: [
      { path: '/energy',      label: 'Energy',      icon: '⚡' },
      { path: '/performance', label: 'Performance', icon: '◔' },
      { path: '/reports',     label: 'Reports',     icon: '📄' },
    ],
  },
  {
    section: 'CONFIGURATION',
    items: [
      { path: '/network',  label: 'Network',        icon: '🌐' },
      { path: '/users',    label: 'Users & Roles',  icon: '👤' },
      { path: '/settings', label: 'Settings',       icon: '⚙'  },
    ],
  },
];

export default function Sidebar({ onLogout }) {
  return (
    <div style={{
      width: 220,
      background: '#fff',
      borderRight: '1px solid #e2ede8',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #e2ede8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, background: '#1a5c3e',
            borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#0f2d1e' }}>BACnet</span>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {NAV.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 8 }}>
            <p style={{
              fontSize: 10, fontWeight: 600, color: '#8aab9b',
              letterSpacing: '0.8px', margin: '12px 8px 4px', textTransform: 'uppercase',
            }}>
              {section}
            </p>
            {items.map(({ path, label, icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 7,
                  textDecoration: 'none',
                  background: isActive ? '#e8f4ef' : 'transparent',
                  color: isActive ? '#1a5c3e' : '#3d6b53',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  transition: 'background 0.1s',
                  marginBottom: 2,
                })}
              >
                <span style={{ fontSize: 14 }}>{icon}</span>
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* User */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid #e2ede8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 4 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#d4ede3', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#1a5c3e',
          }}>
            A
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0f2d1e' }}>Admin</p>
            <p style={{ margin: 0, fontSize: 11, color: '#8aab9b' }}>Administrator</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: 'transparent', color: '#8aab9b', fontSize: 13,
          }}
        >
          ↩ Logout
        </button>
      </div>
    </div>
  );
}
