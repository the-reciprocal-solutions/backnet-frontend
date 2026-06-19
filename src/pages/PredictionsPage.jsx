import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchAnomalyFeed, ackAnomaly, injectAnomaly,
  fetchDevices, fetchDeviceDetail,
} from '../services/api';
import { subscribe, onStatusChange } from '../services/ws';

// Client-side feed id — must match backend AnomalyFeed key so REST ack works.
const feedIdOf = (m) =>
  `${m.type === 'work_order' ? 'work_order' : 'anomaly'}:${m.device_id}:${m.point}`;

// Quick presets — one-shot injections that breach a hard operating limit so
// the detector fires immediately (no forecast needed).
const PRESETS = [
  { label: 'AHU vibration spike', point: 'AHU-01/Vibration', value: 12.0 },
  { label: 'Coil overheat', point: 'AHU-01/SupplyAirTemp', value: 48.0 },
];

const SEV_COLOR = { high: '#d64545', medium: '#d9920a', low: '#3a8a3a' };

function fmtEta(h) {
  if (h == null) return '—';
  if (h < 1) return `~${Math.round(h * 60)} min`;
  return `~${h} h`;
}

export default function PredictionsPage() {
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected');

  // Inject panel state
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [points, setPoints] = useState([]);
  const [point, setPoint] = useState('');
  const [value, setValue] = useState('');
  const [injecting, setInjecting] = useState(false);
  const [flash, setFlash] = useState(null);

  // Upsert a live message, keyed by feed id (newest first, re-surfaces on update).
  const upsert = useCallback((msg) => {
    const item = { ...msg, feed_id: feedIdOf(msg), acked: false };
    setItems((xs) => [item, ...xs.filter((i) => i.feed_id !== item.feed_id)]);
  }, []);

  // Seed from REST once (existing active items), then go live over WebSocket.
  const seed = useCallback(async () => {
    try {
      const data = await fetchAnomalyFeed(false);
      setItems(data.items || []);
      setError(null);
    } catch (e) {
      setError(e.message || 'feed unreachable');
    }
  }, []);

  useEffect(() => {
    seed();
    const unAnom = subscribe('anomaly', upsert);
    const unWork = subscribe('work_order', upsert);
    const unStat = onStatusChange(setWsStatus);
    return () => { unAnom(); unWork(); unStat(); };
  }, [seed, upsert]);

  // Device list for the inject selector.
  useEffect(() => {
    fetchDevices().then((d) => setDevices(d || [])).catch(() => {});
  }, []);

  // Points for the selected device.
  useEffect(() => {
    if (!deviceId) { setPoints([]); setPoint(''); return; }
    fetchDeviceDetail(deviceId)
      .then((d) => setPoints(d?.points || []))
      .catch(() => setPoints([]));
  }, [deviceId]);

  async function doInject(dId, pt, val) {
    setInjecting(true);
    setFlash(null);
    try {
      await injectAnomaly(dId, pt, Number(val));
      setFlash({ ok: true, msg: `Injected ${pt} = ${val} — watch the grid` });
      // No manual refresh: the pipeline broadcasts the result over WebSocket.
    } catch (e) {
      setFlash({ ok: false, msg: e.message || 'inject failed' });
    } finally {
      setInjecting(false);
    }
  }

  function onInjectClick() {
    if (!deviceId || !point || value === '') return;
    doInject(deviceId, point, value);
  }

  function onPreset(p) {
    // Presets target AHU-01 (device_id 1001) by convention.
    const dev = devices.find((d) => d.name?.startsWith(p.point.split('/')[0]));
    doInject(dev?.device_id ?? 1001, p.point, p.value);
  }

  async function onAck(feedId) {
    try { await ackAnomaly(feedId); setItems((xs) => xs.filter((i) => i.feed_id !== feedId)); }
    catch { /* ignore */ }
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
        Predictive Alerts
        <span style={{
          marginLeft: 12, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 11,
          background: wsStatus === 'connected' ? '#e6f4ec' : '#fdeaea',
          color: wsStatus === 'connected' ? '#1f7a4d' : '#d64545',
        }}>
          {wsStatus === 'connected' ? '● live' : `● ${wsStatus}`}
        </span>
      </h1>
      <p style={{ color: '#667', marginBottom: 20 }}>
        Live AI predictions — which device may fail, when, and why. {items.length} active.
      </p>

      {/* ---- Inject panel ---- */}
      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Inject anomaly (one-shot)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} style={input}>
            <option value="">Select device…</option>
            {devices.map((d) => (
              <option key={d.device_id} value={d.device_id}>{d.name} (#{d.device_id})</option>
            ))}
          </select>
          <select value={point} onChange={(e) => setPoint(e.target.value)} style={input} disabled={!points.length}>
            <option value="">Select point…</option>
            {points.map((p) => (
              <option key={p.object_name} value={p.object_name}>
                {p.object_name}{p.units ? ` (${p.units})` : ''}
              </option>
            ))}
          </select>
          <input
            type="number" placeholder="value" value={value}
            onChange={(e) => setValue(e.target.value)} style={{ ...input, width: 110 }}
          />
          <button onClick={onInjectClick} disabled={injecting || !deviceId || !point || value === ''} style={btn}>
            {injecting ? 'Injecting…' : 'Inject'}
          </button>
          <span style={{ color: '#aaa' }}>|</span>
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => onPreset(p)} disabled={injecting} style={presetBtn}>
              {p.label}
            </button>
          ))}
        </div>
        {flash && (
          <div style={{ marginTop: 10, color: flash.ok ? '#3a8a3a' : '#d64545', fontSize: 13 }}>
            {flash.msg}
          </div>
        )}
      </div>

      {/* ---- Live grid ---- */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {error && <div style={{ padding: 12, color: '#d64545' }}>Feed error: {error}</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f1f5f3', textAlign: 'left' }}>
              {['Severity', 'Device', 'Point', 'What may fail', 'When', 'Why', 'Prob', ''].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#889' }}>
                No active predictions. Inject an anomaly above to see the AI react.
              </td></tr>
            )}
            {items.map((it) => {
              const r = it.reasoning || {};
              const kind = it.type === 'work_order' ? 'Work order' : (it.anomaly?.kind || '—');
              const why = r.explanation || it.reason || '—';
              const eta = it.eta_hours ?? r.eta_hours;
              const prob = it.failure_prob ?? r.failure_prob;
              const open = expanded === it.feed_id;
              return (
                <React.Fragment key={it.feed_id}>
                  <tr
                    onClick={() => setExpanded(open ? null : it.feed_id)}
                    style={{ borderTop: '1px solid #eef', cursor: 'pointer' }}
                  >
                    <td style={td}>
                      <span style={{
                        ...pill, background: (SEV_COLOR[it.severity] || '#999') + '22',
                        color: SEV_COLOR[it.severity] || '#666',
                      }}>{it.severity}</span>
                    </td>
                    <td style={td}>{String(it.point).split('/')[0]}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{it.point}</td>
                    <td style={td}>{kind.replace(/_/g, ' ')}</td>
                    <td style={td}>{fmtEta(eta)}</td>
                    <td style={{ ...td, maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{why}</td>
                    <td style={td}>{prob != null ? `${Math.round(prob * 100)}%` : '—'}</td>
                    <td style={td}>
                      <button onClick={(e) => { e.stopPropagation(); onAck(it.feed_id); }} style={ackBtn}>ack</button>
                    </td>
                  </tr>
                  {open && (
                    <tr style={{ background: '#fafcfb' }}>
                      <td colSpan={8} style={{ padding: '12px 16px', color: '#445', whiteSpace: 'pre-wrap' }}>
                        {it.type === 'work_order' && <div><b>Action:</b> {it.action}</div>}
                        <div style={{ margintop: 6 }}><b>Reason:</b> {why}</div>
                        {it.value != null && <div><b>Value:</b> {it.value} {it.unit}</div>}
                        <div style={{ color: '#99a', fontSize: 12, marginTop: 6 }}>{it.ts}</div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const card = { background: '#fff', border: '1px solid #e6ece9', borderRadius: 10, padding: 16, marginBottom: 20 };
const input = { padding: '7px 10px', border: '1px solid #cdd6d1', borderRadius: 6, fontSize: 14 };
const btn = { padding: '7px 16px', background: '#1f7a4d', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer', fontSize: 14 };
const presetBtn = { padding: '7px 12px', background: '#eef4f1', color: '#1f7a4d', border: '1px solid #cfe0d8', borderRadius: 6, cursor: 'pointer', fontSize: 13 };
const ackBtn = { padding: '3px 10px', background: '#f1f5f3', border: '1px solid #d6ddd9', borderRadius: 5, cursor: 'pointer', fontSize: 12 };
const th = { padding: '10px 12px', fontWeight: 600, color: '#556' };
const td = { padding: '9px 12px', color: '#334' };
const pill = { padding: '2px 9px', borderRadius: 11, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' };
