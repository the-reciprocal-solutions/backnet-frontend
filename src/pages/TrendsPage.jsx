import React, { useState, useEffect } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fetchDevices, fetchDeviceDetail, fetchHistory, fetchForecast } from '../services/api';

const RES_OPTIONS = ['raw', '1m', '15m', '1h'];

export default function TrendsPage() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [points, setPoints] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pointsLoading, setPointsLoading] = useState(false);

  const [res, setRes] = useState('1m');
  const [chartData, setChartData] = useState([]);   // [{t, value, p50, p10, p90, band}]
  const [chartLoading, setChartLoading] = useState(false);
  const [forecastModel, setForecastModel] = useState(null);

  // Load device list
  useEffect(() => {
    fetchDevices().then(d => { setDevices(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  // Points for the selected device
  useEffect(() => {
    if (!selectedDevice) return;
    setPointsLoading(true);
    setPoints([]);
    setSelectedPoint(null);
    setChartData([]);
    fetchDeviceDetail(selectedDevice.device_id)
      .then(data => {
        const analog = (data.points || []).filter(p =>
          ['analogInput', 'analogValue', 'analogOutput'].includes(p.object_type));
        setPoints(analog);
        setPointsLoading(false);
      })
      .catch(() => setPointsLoading(false));
  }, [selectedDevice]);

  // Real history + forecast for the selected point
  useEffect(() => {
    if (!selectedPoint) return;
    const point = selectedPoint.object_name;
    let cancelled = false;
    setChartLoading(true);
    setForecastModel(null);

    Promise.allSettled([
      fetchHistory(point, { res, limit: 200 }),
      fetchForecast(point, { res, horizon: 12 }),
    ]).then(([hist, fc]) => {
      if (cancelled) return;
      const histRows = (hist.status === 'fulfilled' ? hist.value.points : []).map(p => ({
        t: new Date(p.time).getTime(),
        value: p.avg !== undefined ? p.avg : p.value,
      }));
      let fcRows = [];
      if (fc.status === 'fulfilled') {
        setForecastModel(fc.value.model);
        fcRows = (fc.value.forecast || []).map(f => ({
          t: new Date(f.time).getTime(), p50: f.p50, p10: f.p10, p90: f.p90,
          band: [f.p10, f.p90],
        }));
      }
      // Anchor the forecast line to the last measured point for a continuous join.
      if (histRows.length && fcRows.length) {
        const last = histRows[histRows.length - 1];
        fcRows.unshift({ t: last.t, p50: last.value, p10: last.value, p90: last.value, band: [last.value, last.value] });
      }
      setChartData([...histRows, ...fcRows]);
      setChartLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedPoint, res]);

  const histValues = chartData.filter(d => d.value != null).map(d => d.value);
  const current = histValues.length ? histValues[histValues.length - 1] : null;
  const min = histValues.length ? Math.min(...histValues).toFixed(2) : '--';
  const max = histValues.length ? Math.max(...histValues).toFixed(2) : '--';
  const nextForecast = chartData.filter(d => d.p50 != null).slice(-1)[0]?.p50;
  const units = selectedPoint?.units || '';
  const fmtTime = ms => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#0f2d1e' }}>Trends</h1>

      <div style={card}>
        <h3 style={{ ...cardTitle, marginBottom: 12 }}>Step 1 — Select Device</h3>
        {loading ? <p style={muted}>Loading devices...</p> : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {devices.map(d => (
              <button key={d.device_id} onClick={() => setSelectedDevice(d)}
                style={chip(selectedDevice?.device_id === d.device_id, '#1a5c3e', '#e8f4ef')}>{d.name}</button>
            ))}
          </div>
        )}
      </div>

      {selectedDevice && (
        <div style={{ ...card, marginTop: 16 }}>
          <h3 style={{ ...cardTitle, marginBottom: 12 }}>Step 2 — Select Point on {selectedDevice.name}</h3>
          {pointsLoading ? <p style={muted}>Loading points...</p>
            : points.length === 0 ? <p style={muted}>No analog points found.</p> : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {points.map((p, i) => (
                  <button key={i} onClick={() => setSelectedPoint(p)}
                    style={chip(selectedPoint?.object_name === p.object_name, '#2563eb', '#eff6ff')}>{p.object_name}</button>
                ))}
              </div>
            )}
        </div>
      )}

      {selectedPoint && (
        <>
          <div style={{ display: 'flex', gap: 14, margin: '16px 0' }}>
            {[
              ['Current', current != null ? `${current} ${units}` : '--'],
              ['Min', `${min} ${units}`],
              ['Max', `${max} ${units}`],
              ['Forecast (next)', nextForecast != null ? `${nextForecast.toFixed(2)} ${units}` : '--'],
            ].map(([l, v]) => (
              <div key={l} style={stat}>
                <p style={statLabel}>{l}</p>
                <p style={statVal}>{v}</p>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={cardTitle}>{selectedDevice.name} — {selectedPoint.object_name}</h3>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {RES_OPTIONS.map(r => (
                  <button key={r} onClick={() => setRes(r)}
                    style={chip(res === r, '#2563eb', '#eff6ff', true)}>{r}</button>
                ))}
              </div>
            </div>

            {chartLoading ? <p style={muted}>Loading history…</p> : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f2" />
                  <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time"
                    tickFormatter={fmtTime} tick={{ fontSize: 11, fill: '#8aab9b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#8aab9b' }} domain={['auto', 'auto']} />
                  <Tooltip labelFormatter={fmtTime}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2ede8' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area dataKey="band" stroke="none" fill="#93c5fd" fillOpacity={0.25} name="p10–p90" connectNulls />
                  <Line dataKey="value" stroke="#2563eb" dot={false} strokeWidth={2.5} name="History" connectNulls />
                  <Line dataKey="p50" stroke="#7c3aed" dot={false} strokeWidth={2} strokeDasharray="6 4" name="Forecast (p50)" connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            )}
            <p style={{ margin: '12px 0 0', fontSize: 11, color: '#8aab9b' }}>
              Solid = measured history (TimescaleDB). Dashed = forecast
              {forecastModel ? ` (${forecastModel})` : ''}; shaded band = p10–p90 uncertainty.
            </p>
          </div>
        </>
      )}

      {!selectedDevice && !loading && (
        <div style={{ ...card, marginTop: 16, textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ fontSize: 15, color: '#8aab9b', margin: 0 }}>Select a device to explore real history + forecast.</p>
        </div>
      )}
    </div>
  );
}

const card = { background: '#fff', border: '1px solid #e2ede8', borderRadius: 12, padding: '20px 24px' };
const cardTitle = { margin: 0, fontSize: 15, fontWeight: 700, color: '#0f2d1e' };
const muted = { fontSize: 13, color: '#8aab9b' };
const stat = { flex: 1, background: '#fff', border: '1px solid #e2ede8', borderRadius: 12, padding: '14px 18px' };
const statLabel = { margin: '0 0 4px', fontSize: 11, color: '#8aab9b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' };
const statVal = { margin: 0, fontSize: 20, fontWeight: 700, color: '#2563eb' };
const chip = (active, color, bg, small) => ({
  padding: small ? '4px 10px' : '6px 16px', borderRadius: 8, fontSize: small ? 12 : 13,
  border: active ? `2px solid ${color}` : '1px solid #c8ddd2',
  background: active ? bg : '#fff', color: active ? color : '#3d6b53',
  fontWeight: active ? 700 : 400, cursor: 'pointer',
});
