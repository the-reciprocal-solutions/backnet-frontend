import React, { useEffect, useMemo, useState } from 'react';
import StatCard from '../components/StatCard';
import { fetchDevices, fetchAlarms, fetchEvents } from '../services/api';

const REPORTS = [
  { key: 'inventory', label: 'Device Inventory' },
  { key: 'alarms', label: 'Alarm History' },
  { key: 'events', label: 'Event Log' },
];

// --- styles -----------------------------------------------------------------
const cardStyle = {
  background: '#fff',
  border: '1px solid #e2ede8',
  borderRadius: 12,
  padding: 20,
};
const primaryBtn = {
  background: '#1a5c3e',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '9px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
const thStyle = {
  textAlign: 'left',
  background: '#f3f9f6',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  color: '#5a7d6b',
  fontWeight: 600,
  padding: '10px 12px',
};
const tdStyle = { padding: '10px 12px', fontSize: 13, color: '#0f2d1e' };

function tabStyle(active) {
  return {
    background: active ? '#e8f4ef' : '#fff',
    color: active ? '#1a5c3e' : '#5a7d6b',
    border: '1px solid #e2ede8',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

// --- CSV helpers ------------------------------------------------------------
function toCsv(columns, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(',');
  const body = rows
    .map((r) => columns.map((c) => esc(r[c.key])).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function fmtTime(t) {
  if (!t) return '';
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? String(t) : d.toLocaleString();
}

export default function ReportsPage() {
  const [report, setReport] = useState('inventory');
  const [devices, setDevices] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchDevices(),
      fetchAlarms(false, 100),
      fetchEvents(100),
    ])
      .then(([d, a, e]) => {
        if (cancelled) return;
        setDevices(Array.isArray(d) ? d : []);
        setAlarms(Array.isArray(a) ? a : []);
        setEvents(Array.isArray(e) ? e : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load report data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Build the current report's columns + rows + summary cards.
  const view = useMemo(() => {
    if (report === 'inventory') {
      const online = devices.filter(
        (d) => String(d.status).toLowerCase() === 'online'
      ).length;
      const offline = devices.length - online;
      const totalPoints = devices.reduce(
        (s, d) => s + (Number(d.point_count) || 0),
        0
      );
      return {
        filename: 'device-inventory-report.csv',
        columns: [
          { key: 'device_id', label: 'Device ID' },
          { key: 'name', label: 'Name' },
          { key: 'description', label: 'Description' },
          { key: 'status', label: 'Status' },
          { key: 'point_count', label: 'Points' },
        ],
        rows: devices,
        cards: [
          { label: 'Total Devices', value: devices.length, icon: '📟' },
          { label: 'Online', value: online, icon: '🟢', subColor: '#1a5c3e' },
          { label: 'Offline', value: offline, icon: '🔴', subColor: '#dc2626' },
          { label: 'Total Points', value: totalPoints, icon: '📊' },
        ],
      };
    }

    if (report === 'alarms') {
      const bySeverity = {};
      alarms.forEach((a) => {
        const sev = a.severity || 'unknown';
        bySeverity[sev] = (bySeverity[sev] || 0) + 1;
      });
      const sevSub = Object.entries(bySeverity)
        .map(([k, v]) => `${k}: ${v}`)
        .join('  ');
      const active = alarms.filter((a) => !a.cleared_at).length;
      return {
        filename: 'alarm-history-report.csv',
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'device_id', label: 'Device' },
          { key: 'point_name', label: 'Point' },
          { key: 'severity', label: 'Severity' },
          { key: 'message', label: 'Message' },
          { key: 'raised_at', label: 'Raised' },
          { key: 'cleared_at', label: 'Cleared' },
        ],
        rows: alarms,
        cards: [
          { label: 'Total Alarms', value: alarms.length, icon: '🔔' },
          { label: 'Active', value: active, icon: '⚠️', subColor: '#dc2626' },
          {
            label: 'Severities',
            value: Object.keys(bySeverity).length,
            sub: sevSub,
            icon: '🏷️',
          },
        ],
        timeCols: ['raised_at', 'cleared_at'],
      };
    }

    // events
    const byType = {};
    events.forEach((e) => {
      const t = e.event_type || 'unknown';
      byType[t] = (byType[t] || 0) + 1;
    });
    const typeSub = Object.entries(byType)
      .map(([k, v]) => `${k}: ${v}`)
      .join('  ');
    const delivered = events.filter((e) => e.delivered).length;
    return {
      filename: 'event-log-report.csv',
      columns: [
        { key: 'id', label: 'ID' },
        { key: 'event_type', label: 'Type' },
        { key: 'timestamp', label: 'Timestamp' },
        { key: 'payload', label: 'Payload' },
        { key: 'delivered', label: 'Delivered' },
      ],
      rows: events,
      cards: [
        { label: 'Total Events', value: events.length, icon: '📜' },
        { label: 'Delivered', value: delivered, icon: '✅', subColor: '#1a5c3e' },
        {
          label: 'Event Types',
          value: Object.keys(byType).length,
          sub: typeSub,
          icon: '🏷️',
        },
      ],
      timeCols: ['timestamp'],
    };
  }, [report, devices, alarms, events]);

  function renderCell(col, row) {
    let v = row[col.key];
    if (view.timeCols && view.timeCols.includes(col.key)) return fmtTime(v);
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (v && typeof v === 'object') return JSON.stringify(v);
    return v == null || v === '' ? '—' : String(v);
  }

  // CSV uses serialized values so objects/times stay readable in the file.
  function handleExport() {
    const csvRows = view.rows.map((row) => {
      const out = {};
      view.columns.forEach((c) => {
        let v = row[c.key];
        if (view.timeCols && view.timeCols.includes(c.key)) v = fmtTime(v);
        else if (v && typeof v === 'object') v = JSON.stringify(v);
        out[c.key] = v;
      });
      return out;
    });
    downloadCsv(view.filename, toCsv(view.columns, csvRows));
  }

  if (loading) return <p style={{ padding: 40, color: '#5a7d6b' }}>Loading reports…</p>;
  if (error) return <p style={{ padding: 40, color: '#dc2626' }}>{error}</p>;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f2d1e' }}>
            Reports
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5a7d6b' }}>
            Generate and export reports from live system data
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={primaryBtn} onClick={handleExport}>
            Export CSV
          </button>
          <button style={primaryBtn} onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {REPORTS.map((r) => (
          <button
            key={r.key}
            style={tabStyle(report === r.key)}
            onClick={() => setReport(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        {view.cards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            sub={c.sub}
            subColor={c.subColor}
            icon={c.icon}
          />
        ))}
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {view.rows.length === 0 ? (
          <p style={{ padding: 40, color: '#5a7d6b' }}>
            No data available for this report.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {view.columns.map((c) => (
                    <th key={c.key} style={thStyle}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.rows.map((row, i) => (
                  <tr key={row.id ?? row.device_id ?? i} style={{ borderTop: '1px solid #eef5f1' }}>
                    {view.columns.map((c) => (
                      <td key={c.key} style={tdStyle}>
                        {renderCell(c, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
