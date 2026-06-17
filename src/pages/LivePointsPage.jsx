import React, { useEffect, useMemo, useRef, useState } from 'react';
import StatCard from '../components/StatCard';
import { fetchSnapshot, streamSnapshots } from '../services/api';

// Live present-values, streamed from /api/simulation/stream (SSE ~1s).
// Falls back to a one-shot /snapshot for the initial paint, then the stream
// keeps it fresh. Changed values flash green briefly.

const fmt = (v) =>
  typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2))
  : typeof v === 'boolean' ? (v ? 'true' : 'false')
  : v ?? '—';

export default function LivePointsPage() {
  const [points, setPoints]   = useState([]);   // [{device_id, device_name, point_name, object_type, value, units}]
  const [status, setStatus]   = useState('connecting'); // connecting | live | error
  const [query,  setQuery]    = useState('');
  const [updates, setUpdates] = useState(0);
  const prevValues = useRef({}); // point_name -> last value (for flash)
  const [flashed, setFlashed] = useState({});

  useEffect(() => {
    let alive = true;
    fetchSnapshot()
      .then((snap) => { if (alive && Array.isArray(snap)) setPoints(snap); })
      .catch(() => {});

    const stop = streamSnapshots(
      (snap) => {
        if (!alive || !Array.isArray(snap)) return;
        setStatus('live');
        setUpdates((n) => n + 1);
        // mark changed points for flash
        const changed = {};
        for (const p of snap) {
          if (prevValues.current[p.point_name] !== p.value) changed[p.point_name] = true;
          prevValues.current[p.point_name] = p.value;
        }
        setPoints(snap);
        if (Object.keys(changed).length) {
          setFlashed(changed);
          setTimeout(() => alive && setFlashed({}), 600);
        }
      },
      () => alive && setStatus('error')
    );

    return () => { alive = false; stop(); };
  }, []);

  const deviceCount = useMemo(
    () => new Set(points.map((p) => p.device_id)).size, [points]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return points;
    return points.filter(
      (p) =>
        p.point_name?.toLowerCase().includes(q) ||
        p.device_name?.toLowerCase().includes(q) ||
        p.object_type?.toLowerCase().includes(q)
    );
  }, [points, query]);

  const dot = { connecting: '#d4a017', live: '#16a34a', error: '#dc2626' }[status];
  const label = { connecting: 'Connecting…', live: 'Live', error: 'Disconnected — retrying' }[status];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f2d1e' }}>Live Points</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5a7d6b' }}>
            Real-time present-values streamed from the simulation engine
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#3d6b53', fontWeight: 600 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot, boxShadow: `0 0 0 3px ${dot}22` }} />
          {label}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Points" value={points.length} icon="◉" />
        <StatCard label="Devices" value={deviceCount} icon="🖧" />
        <StatCard label="Stream Updates" value={updates} icon="〰" />
        <StatCard label="Status" value={label} subColor={dot} icon="⚡" />
      </div>

      {/* Search */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by point, device, or type…"
        style={{
          width: 320, maxWidth: '100%', padding: '9px 12px', marginBottom: 14,
          border: '1px solid #c8ddd2', borderRadius: 8, fontSize: 13,
          outline: 'none', color: '#0f2d1e', background: '#fafcfb', boxSizing: 'border-box',
        }}
      />

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e2ede8', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f3f9f6', color: '#5a7d6b', textAlign: 'left' }}>
              {['Device', 'Point', 'Type', 'Value', 'Units'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#8aab9b' }}>
                {status === 'connecting' ? 'Waiting for data…' : 'No points match.'}
              </td></tr>
            )}
            {filtered.map((p) => (
              <tr key={`${p.device_id}-${p.point_name}`} style={{ borderTop: '1px solid #eef5f1' }}>
                <td style={{ padding: '9px 16px', color: '#3d6b53' }}>{p.device_name}</td>
                <td style={{ padding: '9px 16px', color: '#0f2d1e', fontWeight: 500 }}>{p.point_name}</td>
                <td style={{ padding: '9px 16px', color: '#8aab9b', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{p.object_type}</td>
                <td style={{
                  padding: '9px 16px', fontFamily: "'DM Mono', monospace", fontWeight: 600,
                  color: flashed[p.point_name] ? '#16a34a' : '#0f2d1e',
                  background: flashed[p.point_name] ? '#e8f9f0' : 'transparent',
                  transition: 'background 0.5s, color 0.5s',
                }}>{fmt(p.value)}</td>
                <td style={{ padding: '9px 16px', color: '#8aab9b' }}>{p.units || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
