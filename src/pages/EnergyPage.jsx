import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { fetchSnapshot, fetchHistory } from '../services/api';
import StatCard from '../components/StatCard';

const GREEN = '#1a5c3e';
const ENERGY_TERMS = ['kwh', 'kw', 'power', 'watt', 'energy', 'current', 'amp', 'load'];

// A point is "energy-like" if its units or name contain any energy term (case-insensitive).
function isEnergyPoint(p) {
  const hay = `${p.units || ''} ${p.point_name || ''}`.toLowerCase();
  return ENERGY_TERMS.some((t) => hay.includes(t));
}

const num = (v) => (typeof v === 'number' ? v : Number(v));
const fmt = (v) => {
  const n = num(v);
  if (n == null || Number.isNaN(n)) return '--';
  return Math.abs(n) >= 1000 ? n.toFixed(0) : n.toFixed(2);
};

export default function EnergyPage() {
  const [snapshot, setSnapshot] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState(null); // point_name
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  // Load the live snapshot on mount.
  useEffect(() => {
    let cancelled = false;
    fetchSnapshot()
      .then((rows) => {
        if (cancelled) return;
        setSnapshot(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || 'Failed to load snapshot');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Derive history for the selected energy point.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setHistLoading(true);
    fetchHistory(selected, { res: '1m', limit: 120 })
      .then((data) => {
        if (cancelled) return;
        const pts = (data?.points || []).map((p) => ({
          t: new Date(p.time).getTime(),
          avg: p.avg !== undefined ? p.avg : p.value,
        }));
        setHistory(pts);
        setHistLoading(false);
      })
      .catch(() => { if (!cancelled) { setHistory([]); setHistLoading(false); } });
    return () => { cancelled = true; };
  }, [selected]);

  if (loading) return <p style={{ padding: 40, color: '#5a7d6b', fontSize: 14 }}>Loading snapshot…</p>;
  if (error) return <p style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>{error}</p>;

  // Filter energy-like points and rank by value.
  const energyPoints = snapshot
    .filter(isEnergyPoint)
    .map((p) => ({ ...p, _v: num(p.value) }))
    .sort((a, b) => (num(b._v) || 0) - (num(a._v) || 0));

  const total = energyPoints.reduce((s, p) => s + (Number.isFinite(p._v) ? p._v : 0), 0);
  const deviceCount = new Set(energyPoints.map((p) => p.device_id)).size;
  const peak = energyPoints.find((p) => Number.isFinite(p._v));

  const barData = energyPoints.slice(0, 12).map((p) => ({
    name: p.point_name,
    value: Number.isFinite(p._v) ? p._v : 0,
    units: p.units,
  }));

  const fmtTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f2d1e' }}>Energy Monitoring</h1>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#5a7d6b' }}>
        Power & energy KPIs derived from live point values.
      </p>

      {/* Note banner */}
      <div style={{
        background: '#f3f9f6', border: '1px solid #e2ede8', borderRadius: 12,
        padding: '10px 16px', marginBottom: 16, fontSize: 12.5, color: '#5a7d6b',
      }}>
        Derived from live snapshot — dedicated energy/KPI endpoint pending.
      </div>

      {energyPoints.length === 0 ? (
        <div style={card}>
          <p style={{ margin: 0, fontSize: 14, color: '#5a7d6b' }}>
            No power/energy points detected in current snapshot. Add metering points or a
            dedicated <code style={mono}>/api/energy</code> endpoint.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
            <StatCard label="Energy points (derived)" value={energyPoints.length} icon="⚡" />
            <StatCard
              label="Total instantaneous (derived)"
              value={<span style={mono}>{fmt(total)}</span>}
              sub="sum of energy point values"
              icon="∑"
            />
            <StatCard label="Devices w/ energy" value={deviceCount} icon="🏭" />
            <StatCard
              label="Peak point (derived)"
              value={<span style={{ fontSize: 16 }}>{peak ? `${fmt(peak._v)}` : '--'}</span>}
              sub={peak ? `${peak.point_name} ${peak.units || ''}` : '—'}
              icon="📈"
            />
          </div>

          {/* Bar chart: current value per energy point */}
          <div style={{ ...card, marginBottom: 16 }}>
            <h3 style={cardTitle}>Current value per energy point (top 12, derived)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} margin={{ top: 8, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f2" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#5a7d6b' }} angle={-30} textAnchor="end" interval={0} height={50} />
                <YAxis tick={{ fontSize: 11, fill: '#5a7d6b' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2ede8' }} />
                <Bar dataKey="value" fill={GREEN} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table of energy points */}
          <div style={{ ...card, marginBottom: 16 }}>
            <h3 style={cardTitle}>Energy points</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Point', 'Device', 'Type', 'Value', 'Units', ''].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {energyPoints.map((p, i) => (
                    <tr key={`${p.device_id}-${p.point_name}-${i}`} style={{ borderBottom: '1px solid #eef5f1' }}>
                      <td style={td}>{p.point_name}</td>
                      <td style={td}>{p.device_name || p.device_id}</td>
                      <td style={{ ...td, color: '#5a7d6b' }}>{p.object_type}</td>
                      <td style={{ ...td, ...mono, textAlign: 'right' }}>{fmt(p._v)}</td>
                      <td style={{ ...td, color: '#5a7d6b' }}>{p.units || '—'}</td>
                      <td style={td}>
                        <button
                          onClick={() => setSelected(p.point_name)}
                          style={{
                            padding: '4px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                            border: selected === p.point_name ? `2px solid ${GREEN}` : '1px solid #c8ddd2',
                            background: selected === p.point_name ? '#e8f4ef' : '#fff',
                            color: selected === p.point_name ? GREEN : '#3d6b53',
                            fontWeight: selected === p.point_name ? 700 : 400,
                          }}
                        >
                          Trend
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trend line chart for selected point */}
          {selected && (
            <div style={card}>
              <h3 style={cardTitle}>kWh / power trend (derived) — {selected}</h3>
              {histLoading ? (
                <p style={{ padding: 40, color: '#5a7d6b', fontSize: 14 }}>Loading history…</p>
              ) : history.length === 0 ? (
                <p style={{ padding: 20, color: '#5a7d6b', fontSize: 13 }}>No history available for this point.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={history} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f2" />
                    <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time"
                      tickFormatter={fmtTime} tick={{ fontSize: 11, fill: '#5a7d6b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#5a7d6b' }} domain={['auto', 'auto']} />
                    <Tooltip labelFormatter={fmtTime}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2ede8' }} />
                    <Line dataKey="avg" stroke={GREEN} dot={false} strokeWidth={2.5} name="avg" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const card = { background: '#fff', border: '1px solid #e2ede8', borderRadius: 12, padding: '16px 20px' };
const cardTitle = { margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0f2d1e' };
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
const th = {
  textAlign: 'left', padding: '8px 12px', background: '#f3f9f6', fontSize: 11,
  textTransform: 'uppercase', letterSpacing: '0.5px', color: '#5a7d6b', fontWeight: 600,
};
const td = { padding: '8px 12px', color: '#0f2d1e' };
