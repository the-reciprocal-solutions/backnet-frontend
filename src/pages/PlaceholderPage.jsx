import React from 'react';

export default function PlaceholderPage({ name }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '60vh',
    }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>🏗️</div>
      <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 700, color: '#3d6b53' }}>{name}</h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#8aab9b', textAlign: 'center', maxWidth: 360 }}>
        This page will be connected to the FastAPI backend. Come back once the backend integration is ready.
      </p>
      <div style={{
        background: '#e8f4ef', border: '1px dashed #a8d5bc',
        borderRadius: 10, padding: '12px 24px',
        fontSize: 13, color: '#1a5c3e', fontWeight: 500,
      }}>
        Backend integration pending ✦
      </div>
    </div>
  );
}
