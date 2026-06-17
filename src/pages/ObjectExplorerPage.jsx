import React, { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/StatCard';
import { fetchDevices, fetchDeviceDetail, writePointValue, ApiError } from '../services/api';

const card = {
  background: '#fff',
  border: '1px solid #e2ede8',
  borderRadius: 12,
  padding: '16px 20px',
};

const cardTitle = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
  color: '#0f2d1e',
};

const thStyle = {
  textAlign: 'left',
  padding: '9px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: '#5a7d6b',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  background: '#f3f9f6',
};

const mono = "'DM Mono', monospace";

// Parse an input string into the value type to write. Numbers → number,
// true/false → bool, everything else stays a string.
function parseValue(raw) {
  const t = raw.trim();
  if (t === '') return '';
  const low = t.toLowerCase();
  if (low === 'true') return true;
  if (low === 'false') return false;
  if (t !== '' && !isNaN(Number(t))) return Number(t);
  return t;
}

function PointRow({ deviceId, point, onWritten }) {
  const [draft, setDraft] = useState(
    point.present_value === null || point.present_value === undefined
      ? ''
      : String(point.present_value)
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: 'ok'|'err', text }

  const handleWrite = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await writePointValue(deviceId, point.object_name, parseValue(draft));
      setMsg({ kind: 'ok', text: 'Written' });
      await onWritten();
    } catch (err) {
      const text = err instanceof ApiError
        ? `${err.message}${err.status ? ` (${err.status})` : ''}`
        : err.message || 'Write failed';
      setMsg({ kind: 'err', text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr style={{ borderTop: '1px solid #eef5f1' }}>
      <td style={{ padding: '9px 12px', color: '#3d6b53', fontFamily: mono, fontSize: 12 }}>
        {point.object_type}
      </td>
      <td style={{ padding: '9px 12px', color: '#5a7d6b', fontFamily: mono, fontSize: 12 }}>
        {point.object_instance}
      </td>
      <td style={{ padding: '9px 12px', color: '#0f2d1e', fontWeight: 600, fontSize: 13 }}>
        {point.object_name}
      </td>
      <td style={{ padding: '9px 12px', color: '#5a7d6b', fontSize: 12 }}>
        {point.description || '—'}
      </td>
      <td style={{ padding: '9px 12px', color: '#0f2d1e', fontFamily: mono, fontSize: 13 }}>
        {point.present_value === null || point.present_value === undefined
          ? '—'
          : String(point.present_value)}
      </td>
      <td style={{ padding: '9px 12px', color: '#5a7d6b', fontSize: 12 }}>
        {point.units || '—'}
      </td>
      <td style={{ padding: '9px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            placeholder="value"
            style={{
              width: 70,
              padding: '4px 8px',
              border: '1px solid #c8ddd2',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: mono,
              color: '#0f2d1e',
              outline: 'none',
              background: busy ? '#f3f9f6' : '#fff',
            }}
          />
          <button
            onClick={handleWrite}
            disabled={busy || draft.trim() === ''}
            style={{
              padding: '4px 12px',
              background: busy || draft.trim() === '' ? '#9bc3ae' : '#1a5c3e',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: busy || draft.trim() === '' ? 'default' : 'pointer',
            }}
          >
            {busy ? '…' : 'Write'}
          </button>
          {msg && (
            <span style={{ fontSize: 11, color: msg.kind === 'ok' ? '#16a34a' : '#dc2626' }}>
              {msg.text}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function ObjectExplorerPage() {
  const [devices, setDevices] = useState([]);
  const [devLoading, setDevLoading] = useState(true);
  const [devError, setDevError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDevices()
      .then((data) => { setDevices(data); setDevLoading(false); })
      .catch((err) => { setDevError(err.message); setDevLoading(false); });
  }, []);

  const loadDetail = useCallback((id) => {
    setDetailLoading(true);
    setDetailError(null);
    return fetchDeviceDetail(id)
      .then((data) => { setDetail(data); setDetailLoading(false); })
      .catch((err) => { setDetailError(err.message); setDetailLoading(false); });
  }, []);

  const selectDevice = (id) => {
    setSelectedId(id);
    setSearch('');
    setDetail(null);
    loadDetail(id);
  };

  const refreshDetail = useCallback(() => {
    if (selectedId != null) return loadDetail(selectedId);
    return Promise.resolve();
  }, [selectedId, loadDetail]);

  const points = detail?.points || [];
  const filteredPoints = points.filter((p) =>
    !search ||
    (p.object_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f2d1e' }}>
          Object Explorer
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5a7d6b' }}>
          Browse BACnet devices and inspect, monitor, and write their objects.
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard
          label="Devices"
          value={devLoading ? '—' : devices.length}
          sub="Discovered on network"
          icon="D"
        />
        <StatCard
          label="Selected Device"
          value={detail ? detail.name : '—'}
          sub={detail ? `ID ${detail.device_id}` : 'None selected'}
          icon="*"
        />
        <StatCard
          label="Objects"
          value={detail ? points.length : '—'}
          sub={detail ? `${filteredPoints.length} shown` : 'Select a device'}
          icon="O"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left: device list */}
        <div style={card}>
          <h3 style={{ ...cardTitle, marginBottom: 12 }}>Devices</h3>
          {devLoading && (
            <p style={{ padding: 40, color: '#5a7d6b', fontSize: 14 }}>Loading…</p>
          )}
          {devError && (
            <p style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>Error: {devError}</p>
          )}
          {!devLoading && !devError && devices.length === 0 && (
            <p style={{ padding: 40, color: '#5a7d6b', fontSize: 14 }}>No devices found.</p>
          )}
          {!devLoading && !devError && devices.map((d) => {
            const active = d.device_id === selectedId;
            return (
              <button
                key={d.device_id}
                onClick={() => selectDevice(d.device_id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  marginBottom: 6,
                  border: active ? '1.5px solid #1a5c3e' : '1px solid #e2ede8',
                  borderRadius: 8,
                  background: active ? '#e8f4ef' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: d.status === 'online' ? '#16a34a' : '#dc2626',
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f2d1e' }}>{d.name}</span>
                </div>
                <div style={{ fontSize: 11, color: '#5a7d6b', marginTop: 3 }}>
                  ID {d.device_id} · {d.point_count} pts
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: points table */}
        <div style={card}>
          {selectedId == null && (
            <p style={{ padding: 40, color: '#5a7d6b', fontSize: 14 }}>
              Select a device to view its objects.
            </p>
          )}

          {selectedId != null && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <h3 style={cardTitle}>
                  {detail ? detail.name : 'Objects'}
                </h3>
                {detail?.description && (
                  <span style={{ fontSize: 12, color: '#5a7d6b' }}>{detail.description}</span>
                )}
                <div style={{
                  marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    border: '1px solid #c8ddd2', borderRadius: 7, padding: '5px 10px', background: '#fafcfb',
                  }}>
                    <span style={{ fontSize: 13, color: '#8aab9b' }}>S</span>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search points…"
                      style={{ border: 'none', outline: 'none', fontSize: 12, color: '#0f2d1e', background: 'transparent', width: 140 }}
                    />
                  </div>
                  <button
                    onClick={refreshDetail}
                    disabled={detailLoading}
                    style={{
                      padding: '6px 14px', background: '#1a5c3e', color: '#fff', border: 'none',
                      borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: detailLoading ? 'default' : 'pointer',
                    }}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {detailLoading && (
                <p style={{ padding: 40, color: '#5a7d6b', fontSize: 14 }}>Loading…</p>
              )}
              {detailError && (
                <p style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>Error: {detailError}</p>
              )}
              {!detailLoading && !detailError && points.length === 0 && (
                <p style={{ padding: 40, color: '#5a7d6b', fontSize: 14 }}>
                  This device has no objects.
                </p>
              )}
              {!detailLoading && !detailError && points.length > 0 && filteredPoints.length === 0 && (
                <p style={{ padding: 40, color: '#5a7d6b', fontSize: 14 }}>
                  No points match “{search}”.
                </p>
              )}

              {!detailLoading && !detailError && filteredPoints.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Object Type</th>
                        <th style={thStyle}>Instance</th>
                        <th style={thStyle}>Name</th>
                        <th style={thStyle}>Description</th>
                        <th style={thStyle}>Present Value</th>
                        <th style={thStyle}>Units</th>
                        <th style={thStyle}>Write</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPoints.map((p) => (
                        <PointRow
                          key={`${p.object_type}-${p.object_instance}-${p.object_name}`}
                          deviceId={selectedId}
                          point={p}
                          onWritten={refreshDetail}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
