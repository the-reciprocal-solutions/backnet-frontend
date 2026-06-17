import React from 'react';
import StatCard from '../components/StatCard';
import { getUsername } from '../services/auth';

// Users & Roles. Backend exposes only shared HTTP Basic today — no user/RBAC
// endpoint. This shows the current session + the intended role model, and is
// wired to swap to /api/users + /api/roles when they land.

const ROLES = [
  { role: 'Administrator', color: '#1a5c3e', desc: 'Full access — config, users, write points, work orders' },
  { role: 'Technician',    color: '#2563eb', desc: 'Acknowledge alarms, create/close work orders, write points' },
  { role: 'Viewer',        color: '#8aab9b', desc: 'Read-only — dashboards, trends, reports' },
];

const PERMS = [
  ['View dashboards / trends', true, true, true],
  ['Acknowledge alarms',       true, true, false],
  ['Create / close work orders', true, true, false],
  ['Write point values',       true, true, false],
  ['Manage webhooks / settings', true, false, false],
  ['Manage users & roles',     true, false, false],
];

export default function UsersPage() {
  const me = getUsername() || 'admin';

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f2d1e' }}>Users &amp; Roles</h1>
      <p style={{ margin: '4px 0 20px', fontSize: 13, color: '#5a7d6b' }}>
        Access control model for the BACnet PdM platform
      </p>

      {/* Backend-pending banner */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92660a' }}>
        ⚠ Backend uses shared HTTP Basic auth today. Per-user accounts + RBAC need <code>/api/auth</code>, <code>/api/users</code>, <code>/api/roles</code> — pending. UI below is the target model.
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        <StatCard label="Current User" value={me} icon="👤" />
        <StatCard label="Roles Defined" value={ROLES.length} icon="🛡" />
        <StatCard label="Auth Mode" value="HTTP Basic" sub="JWT/RBAC pending" subColor="#d4a017" icon="🔑" />
      </div>

      {/* Roles */}
      <div style={{ background: '#fff', border: '1px solid #e2ede8', borderRadius: 12, padding: '18px 22px', marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0f2d1e' }}>Roles</h3>
        {ROLES.map(r => (
          <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f5f2' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
            <span style={{ width: 130, fontSize: 13, fontWeight: 700, color: '#0f2d1e' }}>{r.role}</span>
            <span style={{ fontSize: 13, color: '#5a7d6b' }}>{r.desc}</span>
          </div>
        ))}
      </div>

      {/* Permission matrix */}
      <div style={{ background: '#fff', border: '1px solid #e2ede8', borderRadius: 12, overflow: 'hidden' }}>
        <h3 style={{ margin: 0, padding: '16px 22px 6px', fontSize: 15, fontWeight: 700, color: '#0f2d1e' }}>Permission Matrix</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f3f9f6', color: '#5a7d6b' }}>
              {['Capability', 'Admin', 'Technician', 'Viewer'].map((h, i) => (
                <th key={h} style={{ padding: '10px 22px', textAlign: i === 0 ? 'left' : 'center', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMS.map(([cap, ...allowed]) => (
              <tr key={cap} style={{ borderTop: '1px solid #eef5f1' }}>
                <td style={{ padding: '9px 22px', color: '#0f2d1e' }}>{cap}</td>
                {allowed.map((ok, i) => (
                  <td key={i} style={{ padding: '9px 22px', textAlign: 'center', color: ok ? '#16a34a' : '#d1d5db', fontWeight: 700 }}>
                    {ok ? '✓' : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
