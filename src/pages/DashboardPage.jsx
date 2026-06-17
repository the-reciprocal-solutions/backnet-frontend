import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import StatCard   from '../components/StatCard';
import DonutChart from '../components/DonutChart';
import { fetchDevices, fetchAlarms, fetchEvents, fetchSnapshot, fetchKpi, fetchPredictions } from '../services/api';

const PIE_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#0891b2', '#d4a017', '#dc2626'];

// Pick a representative live value from the snapshot by units/name hints.
function pickValue(snap, { units, name }) {
  const p = snap.find(s =>
    (units && s.units?.toLowerCase().includes(units)) ||
    (name && s.point_name?.toLowerCase().includes(name))
  );
  return p ? Number(p.value) : null;
}

// Map API severity to display label
function severityLabel(s) {
  if (!s) return 'INFO';
  if (s === 'critical' || s === 'high') return 'ALARM';
  if (s === 'medium') return 'WARN';
  return 'INFO';
}

export default function DashboardPage() {
  const [time,    setTime]    = useState(new Date());
  const [devices, setDevices] = useState([]);
  const [alarms,  setAlarms]  = useState([]);
  const [events,  setEvents]  = useState([]);
  const [snapshot, setSnapshot] = useState([]);
  const [liveSeries, setLiveSeries] = useState([]); // rolling real values
  const [kpi, setKpi] = useState(null);
  const [preds, setPreds] = useState([]);
  const [hoveredAnomaly, setHoveredAnomaly] = useState(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch real data with polling for "realtime" feel
  useEffect(() => {
    const fetchData = () => {
      fetchDevices().then(setDevices).catch(() => {});
      fetchAlarms().then(setAlarms).catch(() => {});
      fetchEvents().then(setEvents).catch(() => {});
      fetchKpi().then(setKpi).catch(() => {});
      fetchPredictions().then(p => setPreds(Array.isArray(p) ? p : [])).catch(() => {});
      fetchSnapshot().then(snap => {
        if (!Array.isArray(snap)) return;
        setSnapshot(snap);
        // Append real temp/humidity/co2 values to a rolling client-side series.
        const temp     = pickValue(snap, { units: 'celsius', name: 'temp' });
        const humidity = pickValue(snap, { name: 'humid' });
        const co2      = pickValue(snap, { name: 'co2' });
        setLiveSeries(prev => [
          ...prev.slice(-29),
          { time: new Date().toLocaleTimeString().slice(0, 5), temp, humidity, co2 },
        ]);
      }).catch(() => {});
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  // Points-by-object-type from the live snapshot
  const pieData = (() => {
    const counts = {};
    for (const p of snapshot) counts[p.object_type] = (counts[p.object_type] || 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  // Computed from real device data
  const online      = devices.filter(d => d.status === 'online').length;
  const offline     = devices.filter(d => d.status === 'offline').length;
  const totalPoints = devices.reduce((s, d) => s + (d.point_count || 0), 0);
  const onlinePct   = devices.length ? Math.round((online / devices.length) * 100) : 0;

  // Active alarms = not cleared
  const activeAlarms    = alarms.filter(a => !a.cleared_at);
  const criticalAlarms  = alarms.filter(a => a.severity === 'critical' || a.severity === 'high');

  // Anomalies = medium severity (per backend-api.md)
  const anomalies = activeAlarms.filter(a => a.severity === 'medium');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#0f2d1e', letterSpacing: '-0.5px' }}>
            BACnet Dashboard
          </h1>

          {/* Anomaly Grid */}
          {anomalies.length > 0 && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(${Math.min(10, anomalies.length)}, 10px)`, 
                gap: 4, 
                background: '#fff5f0', 
                padding: '6px 8px', 
                borderRadius: 6, 
                border: '1px solid #ffedd5',
                maxHeight: 60,
                overflowY: 'auto'
              }}>
                {anomalies.map(a => (
                  <div
                    key={a.id}
                    onMouseEnter={() => setHoveredAnomaly(a)}
                    onMouseLeave={() => setHoveredAnomaly(null)}
                    style={{ 
                      width: 10, 
                      height: 10, 
                      borderRadius: 2, 
                      background: '#ea580c', 
                      cursor: 'pointer',
                      transition: 'transform 0.1s',
                      transform: hoveredAnomaly?.id === a.id ? 'scale(1.3)' : 'scale(1)'
                    }}
                  />
                ))}
              </div>
              {hoveredAnomaly && (
                <div style={{
                  position: 'absolute', top: 32, left: 0, zIndex: 100,
                  background: '#111827', color: '#fff', padding: '10px 14px', borderRadius: 8, fontSize: 11,
                  width: 240, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #374151'
                }}>
                  <div style={{ color: '#fb923c', fontWeight: 700, marginBottom: 4, fontSize: 10, textTransform: 'uppercase' }}>
                    Anomaly Detected
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{hoveredAnomaly.point_name}</div>
                  <div style={{ color: '#9ca3af' }}>{hoveredAnomaly.message}</div>
                  <div style={{ marginTop: 6, fontSize: 10, color: '#6b7280' }}>
                    Raised: {new Date(hoveredAnomaly.raised_at).toLocaleTimeString()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#5a7d6b' }}>
            Time: {time.toLocaleTimeString()}
          </span>
          <button style={btnOutline} onClick={() => window.location.reload()}>
            Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards — all real data */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard
          label="Total BACnet Devices"
          value={devices.length || '...'}
          sub={devices.length ? `Online ${online} (${onlinePct}%)` : 'Loading...'}
          icon="+"
        />
        <StatCard
          label="Total Points"
          value={totalPoints ? totalPoints.toLocaleString() : '...'}
          sub={`Across ${devices.length} devices`}
          icon="*"
        />
        <StatCard
          label="Active Alarms"
          value={activeAlarms.length}
          sub={`Critical ${criticalAlarms.length}`}
          subColor="#dc2626"
          icon="!"
        />
        <StatCard
          label="Online Devices"
          value={online}
          sub="Network healthy"
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

      {/* PdM summary — server predictions */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ ...cardTitle, marginBottom: 12 }}>Fleet Health</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 40, fontWeight: 700, color: kpi && kpi.avg_health >= 80 ? '#16a34a' : kpi && kpi.avg_health >= 50 ? '#d4a017' : '#dc2626' }}>
              {kpi ? kpi.avg_health : '—'}
            </span>
            <span style={{ fontSize: 14, color: '#8aab9b' }}>/ 100</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12 }}>
            <span style={{ color: '#5a7d6b' }}>At-risk <b style={{ color: kpi?.assets_at_risk ? '#dc2626' : '#0f2d1e' }}>{kpi?.assets_at_risk ?? 0}</b></span>
            <span style={{ color: '#5a7d6b' }}>Predicted fails <b style={{ color: kpi?.predicted_failures ? '#ea580c' : '#0f2d1e' }}>{kpi?.predicted_failures ?? 0}</b></span>
          </div>
        </div>
        <div style={card}>
          <h3 style={{ ...cardTitle, marginBottom: 12 }}>🎯 Predicted Failures</h3>
          {preds.length === 0 ? (
            <p style={{ color: '#16a34a', fontSize: 13, margin: 0 }}>No failures predicted — all points within normal envelope.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {preds.slice(0, 4).map((p, i) => {
                const c = { critical: '#dc2626', high: '#ea580c', elevated: '#d4a017', watch: '#2563eb' }[p.level] || '#2563eb';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: c, background: c + '18', padding: '2px 8px', borderRadius: 5, textTransform: 'uppercase' }}>{p.level}</span>
                    <span style={{ fontWeight: 600, color: '#0f2d1e' }}>{p.point}</span>
                    <span style={{ color: '#8aab9b', flex: 1, fontSize: 12 }}>{p.reason}</span>
                    <span style={{ color: c, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>
                      {p.eta_minutes == null ? 'watch' : p.eta_minutes === 0 ? 'now' : `${p.eta_minutes}m`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Live Points Chart — mock time series (no telemetry endpoint yet) */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={cardTitle}>Building Overview - Live Points {liveSeries.length === 0 && <span style={{ fontSize: 11, fontWeight: 400, color: '#8aab9b' }}>· collecting…</span>}</h3>
          <div style={{ display: 'flex', gap: 18, fontSize: 12, color: '#5a7d6b', flexWrap: 'wrap' }}>
            {[['#2563eb', 'Temperature (C)'], ['#16a34a', 'Humidity (%)'], ['#ea580c', 'CO2 (ppm)']].map(([c, l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
                {l}
              </span>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={liveSeries} margin={{ top: 4, right: 60, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f2" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#8aab9b' }} />
            <YAxis yAxisId="temp"     tick={{ fontSize: 11, fill: '#2563eb' }} domain={[15, 32]} />
            <YAxis yAxisId="humidity" orientation="right" tick={{ fontSize: 11, fill: '#16a34a' }} domain={[40, 80]} />
            <YAxis yAxisId="co2"      orientation="right" tick={{ fontSize: 11, fill: '#ea580c' }} domain={[500, 1100]} hide />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2ede8' }} />
            <Line yAxisId="temp"     type="monotone" dataKey="temp"     stroke="#2563eb" dot={false} strokeWidth={2} name="Temp (C)"     connectNulls />
            <Line yAxisId="humidity" type="monotone" dataKey="humidity" stroke="#16a34a" dot={false} strokeWidth={2} name="Humidity (%)"  connectNulls />
            <Line yAxisId="co2"      type="monotone" dataKey="co2"      stroke="#ea580c" dot={false} strokeWidth={2} name="CO2 (ppm)"     connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginTop: 20 }}>

        {/* Device Status — real data */}
        <div style={card}>
          <h3 style={{ ...cardTitle, marginBottom: 12 }}>Device Status</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <DonutChart
              segments={[
                { value: online  || 0, color: '#16a34a' },
                { value: offline || 0, color: '#9ca3af' },
              ]}
              total={devices.length || 1}
              label="Devices"
            />
            <div style={{ fontSize: 13 }}>
              {[
                ['#16a34a', 'Online',  `${online} (${onlinePct}%)`],
                ['#9ca3af', 'Offline', `${offline} (${100 - onlinePct}%)`],
              ].map(([c, l, v]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0 }} />
                  <span style={{ color: '#5a7d6b' }}>{l}</span>
                  <span style={{ color: '#0f2d1e', fontWeight: 600, marginLeft: 4 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Active Alarms — real data */}
        <div style={card}>
          <h3 style={{ ...cardTitle, marginBottom: 12 }}>Top Active Alarms</h3>
          {activeAlarms.length === 0 && (
            <p style={{ color: '#16a34a', fontSize: 13 }}>No active alarms</p>
          )}
          {activeAlarms.slice(0, 4).map(a => {
            const sev = severityLabel(a.severity);
            return (
              <div key={a.id} style={{ borderBottom: '1px solid #f0f5f2', paddingBottom: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12 }}>
                    {sev === 'ALARM' ? '[!]' : sev === 'WARN' ? '[~]' : '[i]'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f2d1e', flex: 1 }}>
                    Device {a.device_id} — {a.message?.slice(0, 28) || 'Alarm raised'}
                  </span>
                  <span style={{ fontSize: 11, color: '#8aab9b', whiteSpace: 'nowrap' }}>
                    {new Date(a.raised_at).toLocaleTimeString()}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#8aab9b' }}>
                  Point: {a.point_name} · Severity: {a.severity}
                </p>
              </div>
            );
          })}
        </div>

        {/* Points by Object Type — still mock until API provides this */}
        <div style={card}>
          <h3 style={{ ...cardTitle, marginBottom: 12 }}>Points by Object Type</h3>
          {pieData.length === 0 ? (
            <p style={{ fontSize: 13, color: '#8aab9b' }}>Loading…</p>
          ) : (
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          )}
          <div style={{ marginTop: 8 }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                <span style={{ color: '#5a7d6b', flex: 1 }}>{d.name}</span>
                <span style={{ color: '#0f2d1e', fontWeight: 600 }}>{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Recent Events — real data */}
      <div style={{ ...card, marginTop: 20 }}>
        <h3 style={{ ...cardTitle, marginBottom: 14 }}>Recent Events</h3>
        {events.length === 0 ? (
          <p style={{ fontSize: 13, color: '#8aab9b' }}>No recent events</p>
        ) : (
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2ede8' }}>
                {['Time', 'Type', 'Device', 'Description'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 12px', color: '#8aab9b', fontWeight: 500, fontSize: 11 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 6).map((e, i) => {
                const typeLabel = e.event_type?.replace('_', ' ').toUpperCase() || 'EVENT';
                const color = e.event_type?.includes('alarm') ? '#dc2626' : e.event_type?.includes('value') ? '#2563eb' : '#5a7d6b';
                return (
                  <tr key={e.id || i} style={{ borderBottom: '1px solid #f0f5f2' }}>
                    <td style={{ padding: '9px 12px', color: '#5a7d6b' }}>
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ background: color + '22', color, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        {typeLabel.slice(0, 12)}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: '#0f2d1e' }}>
                      Device {e.payload?.device_id || '—'}
                    </td>
                    <td style={{ padding: '9px 12px', color: '#3d6b53', fontSize: 12 }}>
                      {e.payload?.point_name || e.event_type || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Network Summary */}
      <div style={{ ...card, marginTop: 20 }}>
        <h3 style={{ ...cardTitle, marginBottom: 12 }}>Network Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 40px' }}>
          {[
            ['Total Devices',   devices.length],
            ['Online',          online],
            ['Total Points',    totalPoints.toLocaleString()],
            ['Active Alarms',   activeAlarms.length],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0f5f2', fontSize: 13 }}>
              <span style={{ color: '#5a7d6b' }}>{k}</span>
              <span style={{ color: '#0f2d1e', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
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

const btnOutline = {
  padding: '6px 14px',
  borderRadius: 7,
  border: '1px solid #c8ddd2',
  background: '#fff',
  fontSize: 13,
  color: '#3d6b53',
  cursor: 'pointer',
};
