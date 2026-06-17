import React, { useState, useEffect } from 'react';
import { fetchAlarms } from '../services/api';
import {
  getAckedIds, ackAlarm, unackAlarm,
  getWorkOrders, createWorkOrder, getWorkOrderByAlarm, updateWorkOrder,
} from '../services/workorders';
import { isThresholdNoise } from '../services/predict';

// Map API severity → display category
function getSeverityLabel(severity) {
  if (severity === 'critical' || severity === 'high')   return 'ALARM';
  if (severity === 'medium')                             return 'WARN';
  return 'INFO';
}

const SEVERITY_COLOR = { ALARM: '#dc2626', WARN: '#ea580c', INFO: '#2563eb' };
const SEVERITY_BG    = { ALARM: '#fef2f2', WARN: '#fff7ed', INFO: '#eff6ff' };

export default function AlarmsPage() {
  const [filter,  setFilter]  = useState('All');
  const [alarms,  setAlarms]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [acked,   setAcked]   = useState(new Set());
  const [woByAlarm, setWoByAlarm] = useState({});
  const [workOrders, setWorkOrders] = useState([]);
  const [showWO,  setShowWO]  = useState(false);
  const [showNoise, setShowNoise] = useState(false);

  function refreshWO() {
    setAcked(getAckedIds());
    setWoByAlarm(getWorkOrderByAlarm());
    setWorkOrders(getWorkOrders());
  }

  useEffect(() => {
    // fetch all alarms (not just active) so we can show history too
    fetchAlarms()
      .then(data => { setAlarms(data); setLoading(false); })
      .catch(err  => { setError(err.message); setLoading(false); });
    refreshWO();
  }, []);

  function handleAck(a) {
    if (acked.has(a.id)) unackAlarm(a.id); else ackAlarm(a.id);
    refreshWO();
  }
  function handleCreateWO(a) {
    if (woByAlarm[a.id]) return;
    createWorkOrder(a);
    refreshWO();
  }
  function cycleWOStatus(wo) {
    const next = { open: 'in_progress', in_progress: 'closed', closed: 'open' }[wo.status];
    updateWorkOrder(wo.id, { status: next });
    refreshWO();
  }

  if (loading) return <p style={{ padding: 40, color: '#5a7d6b', fontSize: 14 }}>Loading alarms...</p>;
  if (error)   return <p style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>Error: {error}</p>;

  // Add a derived severity label to each alarm
  const alarmsWithLabel = alarms.map(a => ({
    ...a,
    severityLabel: getSeverityLabel(a.severity),
  }));

  // Split: threshold-deviation noise (per-tick P10–P90 breaches) vs real signal.
  const noiseAlarms  = alarmsWithLabel.filter(isThresholdNoise);
  const signalAlarms = alarmsWithLabel.filter(a => !isThresholdNoise(a));
  // By default suppress the noise — show only actionable signal.
  const base = showNoise ? alarmsWithLabel : signalAlarms;

  // Filter by tab
  const filtered = filter === 'All'
    ? base
    : base.filter(a => a.severityLabel === filter);

  // Counts reflect the signal set (noise excluded)
  const total    = base.length;
  const critical = base.filter(a => a.severity === 'critical' || a.severity === 'high').length;
  const warning  = base.filter(a => a.severity === 'medium').length;
  const info     = base.filter(a => a.severity === 'low').length;
  const active   = base.filter(a => !a.cleared_at).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f2d1e' }}>Alarms</h1>
        <button
          onClick={() => { setLoading(true); fetchAlarms().then(d => { setAlarms(d); setLoading(false); }); }}
          style={{ padding: '6px 14px', background: '#1a5c3e', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards — all from real API */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          ['Total',    total,    '#0f2d1e'],
          ['Active',   active,   '#dc2626'],
          ['Critical', critical, '#dc2626'],
          ['Warning',  warning,  '#ea580c'],
          ['Info',     info,     '#2563eb'],
        ].map(([label, count, color]) => (
          <div key={label} style={{ flex: 1, background: '#fff', border: '1px solid #e2ede8', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, color: '#8aab9b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color }}>{count}</p>
          </div>
        ))}
      </div>

      {/* Noise-suppression banner */}
      {noiseAlarms.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#1e40af' }}>
            🔕 <strong>{noiseAlarms.length}</strong> transient forecast-deviation alarms suppressed as noise
            (per-tick P10–P90 breaches, not failures). See <strong>Performance → Predicted Failures</strong> for real signals.
          </span>
          <button onClick={() => setShowNoise(s => !s)}
            style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 7, border: '1px solid #93c5fd',
              background: showNoise ? '#dbeafe' : '#fff', color: '#1e40af', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {showNoise ? 'Hide noise' : 'Show noise'}
          </button>
        </div>
      )}

      {/* Work Orders panel */}
      <div style={{ background: '#fff', border: '1px solid #e2ede8', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
        <div
          onClick={() => setShowWO(s => !s)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f2d1e' }}>
            🛠 Work Orders <span style={{ color: '#8aab9b', fontWeight: 400 }}>({workOrders.length})</span>
          </span>
          <span style={{ fontSize: 12, color: '#5a7d6b' }}>{showWO ? '▲ hide' : '▼ show'}</span>
        </div>
        {showWO && (
          <div style={{ borderTop: '1px solid #eef5f1', padding: '8px 18px 14px' }}>
            {workOrders.length === 0 ? (
              <p style={{ fontSize: 13, color: '#8aab9b', margin: '8px 0' }}>No work orders. Create one from an active alarm below.</p>
            ) : workOrders.map(wo => {
              const c = { open: '#dc2626', in_progress: '#d4a017', closed: '#16a34a' }[wo.status];
              return (
                <div key={wo.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f0f5f2', fontSize: 13 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: '#1a5c3e', fontWeight: 600 }}>{wo.id}</span>
                  <span style={{ flex: 1, color: '#0f2d1e' }}>{wo.title} <span style={{ color: '#8aab9b' }}>· dev {wo.device_id} · {wo.point_name}</span></span>
                  <button onClick={() => cycleWOStatus(wo)} style={{ background: c + '22', color: c, border: 'none', padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>
                    {wo.status.replace('_', ' ')}
                  </button>
                </div>
              );
            })}
            <p style={{ fontSize: 11, color: '#8aab9b', margin: '10px 0 0' }}>
              Stored locally (interim) — backend <code>/api/workorders</code> pending. Click status to cycle open→in&nbsp;progress→closed.
            </p>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['All', 'ALARM', 'WARN', 'INFO'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 16px', borderRadius: 20,
            border: filter === f ? '1.5px solid #1a5c3e' : '1px solid #c8ddd2',
            background: filter === f ? '#e8f4ef' : '#fff',
            color: filter === f ? '#1a5c3e' : '#5a7d6b',
            fontSize: 12, fontWeight: filter === f ? 700 : 400, cursor: 'pointer',
          }}>
            {f} {f === 'All' ? `(${total})` : f === 'ALARM' ? `(${critical})` : f === 'WARN' ? `(${warning})` : `(${info})`}
          </button>
        ))}
      </div>

      {/* Alarm List — real data */}
      {filtered.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2ede8', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ color: '#16a34a', fontSize: 14, fontWeight: 600, margin: 0 }}>No alarms in this category</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((a, i) => {
          const sev = a.severityLabel;
          const isActive = !a.cleared_at;
          const isAcked = acked.has(a.id);
          const wo = woByAlarm[a.id];
          return (
            <div key={a.id || i} style={{
              background: SEVERITY_BG[sev],
              border: `1px solid ${SEVERITY_COLOR[sev]}33`,
              borderLeft: `4px solid ${SEVERITY_COLOR[sev]}`,
              borderRadius: 10,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}>
              {/* Severity indicator */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: SEVERITY_COLOR[sev] + '22',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 14, color: SEVERITY_COLOR[sev], fontWeight: 700 }}>
                  {sev === 'ALARM' ? '!' : sev === 'WARN' ? '~' : 'i'}
                </span>
              </div>

              {/* Main content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#0f2d1e' }}>
                  Device {a.device_id} — {a.message}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#5a7d6b' }}>
                  Point: {a.point_name}
                  {' · '}
                  Severity: {a.severity}
                  {' · '}
                  Raised: {new Date(a.raised_at).toLocaleString()}
                  {a.cleared_at && ` · Cleared: ${new Date(a.cleared_at).toLocaleString()}`}
                </p>
              </div>

              {/* Status badge */}
              <span style={{
                background: isActive ? SEVERITY_COLOR[sev] + '22' : '#e8f4ef',
                color: isActive ? SEVERITY_COLOR[sev] : '#16a34a',
                padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                whiteSpace: 'nowrap',
              }}>
                {isActive ? sev : 'CLEARED'}
              </span>

              {/* Severity pill */}
              <span style={{
                background: '#f0f5f2', color: '#5a7d6b',
                padding: '3px 10px', borderRadius: 5, fontSize: 11,
                whiteSpace: 'nowrap',
              }}>
                {a.severity}
              </span>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => handleAck(a)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${isAcked ? '#16a34a' : '#c8ddd2'}`,
                    background: isAcked ? '#e8f9f0' : '#fff',
                    color: isAcked ? '#16a34a' : '#3d6b53', whiteSpace: 'nowrap',
                  }}
                >
                  {isAcked ? '✓ Acked' : 'Acknowledge'}
                </button>
                {wo ? (
                  <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#e8f4ef', color: '#1a5c3e', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>
                    {wo.id}
                  </span>
                ) : (
                  <button
                    onClick={() => handleCreateWO(a)}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: '#1a5c3e', color: '#fff', whiteSpace: 'nowrap' }}
                  >
                    + Work Order
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
