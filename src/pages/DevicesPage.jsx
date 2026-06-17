import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import StatCard   from '../components/StatCard';
import DonutChart from '../components/DonutChart';
import { TIME_SERIES } from '../data/mockData';
import { fetchDevices, fetchAssets, fetchAssetHealth } from '../services/api';

const HEALTH_COLOR = (s) => (s == null ? '#9ca3af' : s >= 80 ? '#16a34a' : s >= 50 ? '#d4a017' : '#dc2626');

const networkData = TIME_SERIES.filter((_, i) => i % 3 === 0).map(d => ({
  time:  d.time,
  whoIs: Math.round(10000 + Math.sin(d.temp) * 4000),
  iAm:   Math.round(8000  + Math.cos(d.temp) * 3000),
  read:  Math.round(4000  + Math.sin(d.co2 / 100) * 1500),
  write: Math.round(2000  + Math.cos(d.humidity / 10) * 800),
}));

const TYPE_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#9ca3af'];

export default function DevicesPage() {
  const [filter,  setFilter]  = useState('All');
  const [search,  setSearch]  = useState('');
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [healthByDevice, setHealthByDevice] = useState({}); // device_id -> {score,status}

  useEffect(() => {
    fetchDevices()
      .then(data => { setDevices(data); setLoading(false); })
      .catch(err  => { setError(err.message); setLoading(false); });
    // Asset health per device (PdM) — best-effort, non-blocking
    fetchAssets()
      .then(async assets => {
        const entries = await Promise.all(
          assets.map(a => fetchAssetHealth(a.id)
            .then(h => [a.device_id, { score: h.score, status: h.status }])
            .catch(() => null))
        );
        setHealthByDevice(Object.fromEntries(entries.filter(Boolean)));
      })
      .catch(() => {});
  }, []);

  if (loading) return <p style={{ padding: 40, color: '#5a7d6b', fontSize: 14 }}>Loading devices...</p>;
  if (error)   return <p style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>Error: {error}</p>;

  // ── Computed counts from real data ──────────────────────────────────────
  const online      = devices.filter(d => d.status === 'online').length;
  const offline     = devices.filter(d => d.status === 'offline').length;
  const totalPoints = devices.reduce((sum, d) => sum + (d.point_count || 0), 0);
  const onlinePct   = devices.length ? Math.round((online / devices.length) * 100) : 0;

  // ── Device type breakdown for pie (derived from name prefix) ────────────
  const typeMap = {};
  devices.forEach(d => {
    const prefix = d.name.split('-')[0];
    typeMap[prefix] = (typeMap[prefix] || 0) + 1;
  });
  const typeData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = devices.filter(d => {
    if (filter === 'Online'  && d.status !== 'online')  return false;
    if (filter === 'Offline' && d.status !== 'offline') return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) &&
                  !d.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f2d1e' }}>Devices</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#16a34a' }}>
            Devices online: {online}/{devices.length} ({onlinePct}%)
          </span>
          <button
            onClick={() => { setLoading(true); fetchDevices().then(d => { setDevices(d); setLoading(false); }); }}
            style={{ padding: '6px 14px', background: '#1a5c3e', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards — all from real data */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard
          label="Total BACnet Devices"
          value={devices.length}
          sub={`Online ${online} (${onlinePct}%)`}
          icon="+"
        />
        <StatCard
          label="Total Points"
          value={totalPoints.toLocaleString()}
          sub={`Across ${devices.length} devices`}
          icon="*"
        />
        <StatCard
          label="Online Devices"
          value={online}
          sub={`${onlinePct}% of fleet`}
          subColor="#16a34a"
          icon="O"
        />
        <StatCard
          label="Offline Devices"
          value={offline}
          sub={offline === 0 ? 'All clear' : 'Needs attention'}
          subColor={offline > 0 ? '#dc2626' : '#16a34a'}
          icon="X"
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Device Status Donut — real data */}
        <div style={card}>
          <h3 style={cardTitle}>Device Status Overview</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <DonutChart
              segments={[
                { value: online  || 0, color: '#16a34a' },
                { value: offline || 0, color: '#9ca3af' },
              ]}
              total={devices.length}
              label="Devices"
            />
            <div style={{ fontSize: 12 }}>
              {[
                ['#16a34a', 'Online',  `${online} (${onlinePct}%)`],
                ['#9ca3af', 'Offline', `${offline} (${100 - onlinePct}%)`],
              ].map(([c, l, v]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                  <span style={{ color: '#5a7d6b' }}>{l}</span>
                  <span style={{ color: '#0f2d1e', fontWeight: 600, marginLeft: 4 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Device Type Breakdown — derived from real device names */}
        <div style={card}>
          <h3 style={cardTitle}>Devices by Type</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={typeData} cx="50%" cy="50%" innerRadius={38} outerRadius={60} dataKey="value" paddingAngle={2}>
                  {typeData.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 11 }}>
              {typeData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLORS[i % TYPE_COLORS.length], flexShrink: 0 }} />
                  <span style={{ color: '#5a7d6b' }}>{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Network Activity — mock (no API endpoint for this yet) */}
        <div style={card}>
          <h3 style={cardTitle}>Network Activity (Last 24 Hours)</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, marginBottom: 8 }}>
            {[['#2563eb','Who-Is'],['#16a34a','I-Am'],['#ea580c','Read'],['#7c3aed','Write']].map(([c,l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#5a7d6b' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={networkData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f2" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#8aab9b' }} interval={7} />
              <YAxis tick={{ fontSize: 9, fill: '#8aab9b' }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
              <Line type="monotone" dataKey="whoIs" stroke="#2563eb" dot={false} strokeWidth={1.5} name="Who-Is" />
              <Line type="monotone" dataKey="iAm"   stroke="#16a34a" dot={false} strokeWidth={1.5} name="I-Am"   />
              <Line type="monotone" dataKey="read"  stroke="#ea580c" dot={false} strokeWidth={1.5} name="Read"   />
              <Line type="monotone" dataKey="write" stroke="#7c3aed" dot={false} strokeWidth={1.5} name="Write"  />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Device List */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <h3 style={cardTitle}>Device List</h3>
          <div style={{ display: 'flex', gap: 6, marginLeft: 8, flexWrap: 'wrap' }}>
            {['All', 'Online', 'Offline'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '4px 14px',
                  border: filter === f ? '1.5px solid #1a5c3e' : '1px solid #c8ddd2',
                  borderRadius: 20,
                  background: filter === f ? '#e8f4ef' : '#fff',
                  color: filter === f ? '#1a5c3e' : '#5a7d6b',
                  fontSize: 12,
                  fontWeight: filter === f ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {f === 'All' ? `All (${devices.length})` : f === 'Online' ? `Online (${online})` : `Offline (${offline})`}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #c8ddd2', borderRadius: 7, padding: '5px 10px', background: '#fafcfb' }}>
            <span style={{ fontSize: 14, color: '#8aab9b' }}>S</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search devices..."
              style={{ border: 'none', outline: 'none', fontSize: 12, color: '#0f2d1e', background: 'transparent', width: 150 }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #e2ede8' }}>
                {['', 'Device Name', 'Device ID', 'Description', 'Status', 'Health', 'Points', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', padding: '8px 12px', color: '#8aab9b', fontWeight: 500, fontSize: 11 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.device_id} style={{ borderBottom: '1px solid #f0f5f2' }}>
                  <td style={{ padding: '10px 12px' }}><input type="checkbox" /></td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontWeight: 600, color: '#0f2d1e' }}>{d.name}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#5a7d6b', fontSize: 12 }}>{d.device_id}</td>
                  <td style={{ padding: '10px 12px', color: '#3d6b53', fontSize: 12 }}>{d.description}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.status === 'online' ? '#16a34a' : '#dc2626' }} />
                      <span style={{ color: d.status === 'online' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{d.status}</span>
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {(() => {
                      const h = healthByDevice[d.device_id];
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: HEALTH_COLOR(h?.score) }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: HEALTH_COLOR(h?.score) }} />
                          {h ? h.score : '—'}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#0f2d1e', fontWeight: 600 }}>{d.point_count}</td>
                  <td style={{ padding: '10px 12px', color: '#8aab9b', cursor: 'pointer', fontSize: 18 }}>...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <span style={{ fontSize: 12, color: '#8aab9b' }}>
            Showing {filtered.length} of {devices.length} devices
          </span>
        </div>
      </div>
    </div>
  );
}

const card = {
  background: '#fff',
  border: '1px solid #e2ede8',
  borderRadius: 12,
  padding: '20px 24px',
};

const cardTitle = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
  color: '#0f2d1e',
};
