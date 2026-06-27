import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
      <style>{`
        .discovery-section {
          margin-bottom: 28px;
        }
        .discovery-section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .discovery-section-title {
          font-size: 16px;
          font-weight: 700;
          margin: 0;
          color: #0f2d1e;
        }
        .discovery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 14px;
        }
        .discovery-device-card {
          background: #fff;
          border: 1px solid #e6ece9;
          border-radius: 10px;
          padding: 12px 14px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .discovery-device-card:hover {
          border-color: #b5c3bc;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
          transform: translateY(-2px);
        }
        .discovery-empty-container {
          background: #fff;
          border: 1px solid #e6ece9;
          border-radius: 10px;
          padding: 16px;
          color: #8aab9b;
          font-size: 13px;
        }
      `}</style>

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
        const list = filtered[p] || [];
        const color = PROTO_COLOR[p];
        return (
          <div key={p} className="discovery-section">
            <div className="discovery-section-header">
              <h2 className="discovery-section-title">
                {PROTO_LABEL[p]}
              </h2>
              <span style={{
                ...pill, background: color + '15', color,
              }}>
                {list.length} {list.length === 1 ? 'device' : 'devices'}
              </span>
            </div>

            {list.length === 0 ? (
              <div className="discovery-empty-container">
                {q ? 'No matching devices.' : '0 devices discovered on this protocol.'}
              </div>
            ) : (
              <div className="discovery-grid">
                {list.map((d) => (
                  <Link
                    key={`${p}-${d.device_id}`}
                    to={`/devices?search=${encodeURIComponent(d.name)}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="discovery-device-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: statusColor(d.status), display: 'inline-block', flexShrink: 0,
                          }} />
                          <span style={{ fontWeight: 600, color: '#1a2b22', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }} title={d.name}>
                            {d.name}
                          </span>
                        </span>
                        <span style={{ ...protoBadge, background: color + '15', color }}>
                          {PROTO_LABEL[p]}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#667', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'monospace' }}>#{d.device_id}</span>
                        <span>{d.point_count ?? 0} pts</span>
                      </div>
                      <div style={{ fontSize: 11, color: statusColor(d.status), marginTop: 6, textTransform: 'capitalize', fontWeight: 600 }}>
                        {d.status || 'unknown'}
                      </div>
                    </div>
                  </Link>
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
