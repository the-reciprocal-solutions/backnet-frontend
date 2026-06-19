import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchDiscovery } from '../services/api';

// All four protocols are always rendered, even when empty, so the operator
// sees the full discovery surface.
const PROTOCOLS = ['bacnet', 'mqtt', 'knx', 'modbus'];

const PROTO_LABEL = { bacnet: 'BACnet', mqtt: 'MQTT', knx: 'KNX', modbus: 'Modbus' };
const PROTO_COLOR = { bacnet: '#1f7a4d', mqtt: '#2563a8', knx: '#a86f2b', modbus: '#7a3aa3' };

// Status → dot color. Anything unknown reads as amber (warning).
function statusColor(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'online' || s === 'ok' || s === 'up') return '#3a8a3a';
  if (s === 'offline' || s === 'error' || s === 'down' || s === 'fault') return '#d64545';
  return '#d9920a';
}

export default function DiscoveryPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await fetchDiscovery();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e.message || 'discovery unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + 5s poll, matching the other live pages.
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const protocols = data?.protocols || {};
  const counts = data?.counts || {};
  const total = data?.total ?? 0;

  // Case-insensitive name filter applied across every protocol bucket.
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const out = {};
    for (const p of PROTOCOLS) {
      const list = protocols[p] || [];
      out[p] = q
        ? list.filter((d) => String(d.name || '').toLowerCase().includes(q))
        : list;
    }
    return out;
  }, [protocols, q]);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Discovery</h1>
      <p style={{ color: '#667', marginBottom: 16 }}>
        Devices grouped by protocol. <b>{total}</b> total
        {PROTOCOLS.map((p) => (
          <span key={p} style={{ marginLeft: 10, color: '#778' }}>
            <span style={{ color: PROTO_COLOR[p], fontWeight: 600 }}>{PROTO_LABEL[p]}</span>{' '}
            {counts[p] ?? 0}
          </span>
        ))}
      </p>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Filter devices by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...input, width: 280 }}
        />
      </div>

      {error && (
        <div style={{ ...card, color: '#d64545' }}>Discovery error: {error}</div>
      )}
      {loading && !data && (
        <div style={{ ...card, color: '#889' }}>Loading discovery…</div>
      )}

      {data && PROTOCOLS.map((p) => {
        const list = filtered[p];
        const color = PROTO_COLOR[p];
        return (
          <div key={p} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#223' }}>
                {PROTO_LABEL[p]}
              </h2>
              <span style={{
                ...pill, background: color + '22', color,
              }}>
                {list.length} {list.length === 1 ? 'device' : 'devices'}
              </span>
            </div>

            {list.length === 0 ? (
              <div style={{ ...card, color: '#99a', fontSize: 13 }}>
                {q ? 'No matching devices.' : '0 devices discovered on this protocol.'}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 12,
              }}>
                {list.map((d) => (
                  <div key={`${p}-${d.device_id}`} style={deviceCard}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 9, height: 9, borderRadius: '50%',
                          background: statusColor(d.status), display: 'inline-block',
                        }} />
                        <span style={{ fontWeight: 600, color: '#1a2b22' }}>{d.name}</span>
                      </span>
                      <span style={{ ...protoBadge, background: color + '1a', color }}>
                        {PROTO_LABEL[p]}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#667', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'monospace' }}>#{d.device_id}</span>
                      <span>{d.point_count ?? 0} pts</span>
                    </div>
                    <div style={{ fontSize: 11, color: statusColor(d.status), marginTop: 6, textTransform: 'capitalize' }}>
                      {d.status || 'unknown'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const card = { background: '#fff', border: '1px solid #e6ece9', borderRadius: 10, padding: 16, marginBottom: 20 };
const deviceCard = { background: '#fff', border: '1px solid #e6ece9', borderRadius: 10, padding: '12px 14px' };
const input = { padding: '7px 10px', border: '1px solid #cdd6d1', borderRadius: 6, fontSize: 14 };
const pill = { padding: '2px 9px', borderRadius: 11, fontSize: 12, fontWeight: 600 };
const protoBadge = { padding: '1px 7px', borderRadius: 9, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' };
