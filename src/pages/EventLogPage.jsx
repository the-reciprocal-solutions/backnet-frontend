import React, { useState, useEffect } from 'react';
import { fetchEvents } from '../services/api';

const TYPE_COLOR = {
  alarm_raised:          '#dc2626',
  alarm_cleared:         '#16a34a',
  point_value_changed:   '#2563eb',
  device_status_changed: '#ea580c',
  scenario_started:      '#7c3aed',
  scenario_stopped:      '#9ca3af',
  telemetry_snapshot:    '#0891b2',
};

function typeLabel(eventType) {
  if (!eventType) return 'EVENT';
  return eventType.replace(/_/g, ' ').toUpperCase();
}

function typeColor(eventType) {
  return TYPE_COLOR[eventType] || '#5a7d6b';
}

export default function EventLogPage() {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState('All');
  const [search,  setSearch]  = useState('');
  const [limit,   setLimit]   = useState(50);

  function loadEvents(lim = limit) {
    setLoading(true);
    fetchEvents(lim)
      .then(data => { setEvents(data); setLoading(false); })
      .catch(err  => { setError(err.message); setLoading(false); });
  }

  useEffect(() => { loadEvents(); }, []);

  if (error) return <p style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>Error: {error}</p>;

  // All unique event types for filter tabs
  const eventTypes = ['All', ...Array.from(new Set(events.map(e => e.event_type).filter(Boolean)))];

  const filtered = events.filter(e => {
    if (filter !== 'All' && e.event_type !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      const payloadStr = JSON.stringify(e.payload || '').toLowerCase();
      if (!e.event_type?.includes(s) && !payloadStr.includes(s)) return false;
    }
    return true;
  });

  // Summary counts
  const alarmEvents   = events.filter(e => e.event_type?.includes('alarm')).length;
  const valueEvents   = events.filter(e => e.event_type === 'point_value_changed').length;
  const deviceEvents  = events.filter(e => e.event_type === 'device_status_changed').length;
  const delivered     = events.filter(e => e.delivered).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f2d1e' }}>Event Log</h1>
        <button
          onClick={() => loadEvents()}
          style={{ padding: '6px 14px', background: '#1a5c3e', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          ['Total Events',    events.length,  '#0f2d1e'],
          ['Alarm Events',    alarmEvents,    '#dc2626'],
          ['Value Changes',   valueEvents,    '#2563eb'],
          ['Device Events',   deviceEvents,   '#ea580c'],
          ['Delivered',       delivered,      '#16a34a'],
        ].map(([label, count, color]) => (
          <div key={label} style={{ flex: 1, background: '#fff', border: '1px solid #e2ede8', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, color: '#8aab9b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color }}>{count}</p>
          </div>
        ))}
      </div>

      {/* Filter + Search Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        {/* Event type filter tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {eventTypes.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11,
              border: filter === t ? '1.5px solid #1a5c3e' : '1px solid #c8ddd2',
              background: filter === t ? '#e8f4ef' : '#fff',
              color: filter === t ? '#1a5c3e' : '#5a7d6b',
              fontWeight: filter === t ? 700 : 400, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
              {t === 'All' ? `All (${events.length})` : t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #c8ddd2', borderRadius: 7, padding: '5px 10px', background: '#fafcfb' }}>
          <span style={{ fontSize: 12, color: '#8aab9b' }}>S</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events..."
            style={{ border: 'none', outline: 'none', fontSize: 12, color: '#0f2d1e', background: 'transparent', width: 160 }}
          />
        </div>
      </div>

      {/* Events Table */}
      <div style={{ background: '#fff', border: '1px solid #e2ede8', borderRadius: 12, padding: '0 24px 20px' }}>
        {loading ? (
          <p style={{ padding: '24px 0', color: '#8aab9b', fontSize: 13 }}>Loading events...</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: '24px 0', color: '#8aab9b', fontSize: 13 }}>No events found.</p>
        ) : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #e2ede8' }}>
                {['Time', 'Event Type', 'Device', 'Point / Detail', 'Delivered'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '14px 12px', color: '#8aab9b', fontWeight: 500, fontSize: 11 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const color = typeColor(e.event_type);
                const deviceId   = e.payload?.device_id   || '—';
                const pointName  = e.payload?.point_name  || '—';
                const extraInfo  = e.payload?.new_value != null
                  ? `Value: ${e.payload.new_value}`
                  : e.payload?.status
                  ? `Status: ${e.payload.status}`
                  : pointName;

                return (
                  <tr key={e.id || i} style={{ borderBottom: '1px solid #f0f5f2' }}>
                    {/* Time */}
                    <td style={{ padding: '10px 12px', color: '#5a7d6b', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {new Date(e.timestamp).toLocaleString()}
                    </td>

                    {/* Event Type Badge */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        background: color + '18',
                        color,
                        padding: '3px 10px',
                        borderRadius: 5,
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}>
                        {typeLabel(e.event_type).slice(0, 20)}
                      </span>
                    </td>

                    {/* Device */}
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f2d1e' }}>
                      {deviceId !== '—' ? `Device ${deviceId}` : '—'}
                    </td>

                    {/* Point / Detail */}
                    <td style={{ padding: '10px 12px', color: '#3d6b53', fontSize: 12 }}>
                      {extraInfo}
                    </td>

                    {/* Delivered */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        background: e.delivered ? '#e8f4ef' : '#fef2f2',
                        color: e.delivered ? '#16a34a' : '#dc2626',
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      }}>
                        {e.delivered ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Load More */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <span style={{ fontSize: 12, color: '#8aab9b' }}>
              Showing {filtered.length} of {events.length} events
            </span>
            <button
              onClick={() => { setLimit(l => l + 50); loadEvents(limit + 50); }}
              style={{ padding: '5px 14px', border: '1px solid #c8ddd2', borderRadius: 7, background: '#fff', fontSize: 12, color: '#3d6b53', cursor: 'pointer' }}
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
