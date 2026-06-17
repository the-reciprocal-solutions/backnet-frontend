import React from 'react';

export default function StatCard({ label, value, sub, subColor, icon }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2ede8',
      borderRadius: 12,
      padding: '16px 20px',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{
            margin: '0 0 4px',
            fontSize: 11,
            color: '#8aab9b',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}>
            {label}
          </p>
          <p style={{
            margin: '0 0 6px',
            fontSize: 26,
            fontWeight: 700,
            color: '#0f2d1e',
            letterSpacing: '-0.5px',
          }}>
            {value}
          </p>
          {sub && (
            <p style={{ margin: 0, fontSize: 12, color: subColor || '#5a7d6b' }}>
              {sub}
            </p>
          )}
        </div>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: '#e8f4ef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}
