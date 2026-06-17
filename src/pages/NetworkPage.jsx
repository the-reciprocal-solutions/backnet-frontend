import React, { useEffect, useState } from 'react';
import StatCard from '../components/StatCard';
import { fetchSimStatus, fetchDevices, fetchGenerators } from '../services/api';

const MONO = "'DM Mono', monospace";
const GREEN = '#1a5c3e';

const card = {
  background: '#fff',
  border: '1px solid #e2ede8',
  borderRadius: 12,
  padding: '16px 20px',
};

const panelTitle = {
  margin: '0 0 14px',
  fontSize: 13,
  fontWeight: 700,
  color: '#0f2d1e',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
};

function fmt(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return typeof v === 'number' ? v.toFixed(digits) : String(v);
}

function Tile({ label, value, unit }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 110,
      background: '#f3f9f6',
      border: '1px solid #eef5f1',
      borderRadius: 10,
      padding: '12px 14px',
    }}>
      <p style={{
        margin: '0 0 6px',
        fontSize: 11,
        color: '#5a7d6b',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: GREEN, fontFamily: MONO }}>
        {value}
        {unit && <span style={{ fontSize: 12, color: '#5a7d6b', marginLeft: 4 }}>{unit}</span>}
      </p>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      margin: '0 6px 6px 0',
      background: '#e8f4ef',
      color: GREEN,
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      fontFamily: MONO,
    }}>
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const online = status === 'online';
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.4px',
      color: online ? '#16a34a' : '#dc2626',
      background: online ? '#e8f9f0' : '#fef2f2',
    }}>
      {status || 'unknown'}
    </span>
  );
}

const th = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#5a7d6b',
  fontWeight: 700,
};

const td = {
  padding: '12px 14px',
  fontSize: 13,
  color: '#0f2d1e',
  borderTop: '1px solid #eef5f1',
};

export default function NetworkPage() {
  const [sim, setSim] = useState(null);
  const [devices, setDevices] = useState([]);
  const [generators, setGenerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const [s, d, g] = await Promise.all([
          fetchSimStatus(),
          fetchDevices(),
          fetchGenerators(),
        ]);
        if (!alive) return;
        setSim(s);
        setDevices(Array.isArray(d) ? d : []);
        setGenerators(Array.isArray(g) ? g : []);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || 'Failed to load network data');
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (loading) {
    return <p style={{ padding: 40, color: '#5a7d6b', fontSize: 14 }}>Loading…</p>;
  }
  if (error) {
    return <p style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>{error}</p>;
  }

  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const world = sim?.world_state || {};
  const models = Array.isArray(sim?.models) ? sim.models : [];
  const activeFaults = Array.isArray(sim?.active_faults) ? sim.active_faults : [];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f2d1e' }}>
        Network Overview
      </h1>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#5a7d6b' }}>
        BACnet network &amp; simulation-engine health · auto-refreshing every 5s
      </p>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard
          label="Engine"
          value={sim?.running ? 'Running' : 'Stopped'}
          sub={sim?.enabled ? 'enabled' : 'disabled'}
          subColor={sim?.running ? '#16a34a' : '#dc2626'}
          icon="⚙️"
        />
        <StatCard
          label="Tick rate"
          value={`${fmt(sim?.tick_hz, 1)} Hz`}
          sub={`${fmt(sim?.speed, 1)}× speed`}
          icon="⏱️"
        />
        <StatCard
          label="Generators"
          value={sim?.generator_count ?? generators.length}
          sub="active point sources"
          icon="🔌"
        />
        <StatCard
          label="Devices online"
          value={`${onlineCount}/${devices.length}`}
          sub="reachable devices"
          subColor={onlineCount === devices.length ? '#16a34a' : '#dc2626'}
          icon="🖧"
        />
      </div>

      {/* Engine + World panels */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ ...card, flex: 1, minWidth: 320 }}>
          <p style={panelTitle}>Engine</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <Tile label="Sim hour" value={fmt(sim?.sim_hour, 1)} unit="h" />
            <Tile label="Ticks" value={sim?.tick_count ?? '—'} />
            <Tile label="Sim seconds" value={fmt(sim?.sim_seconds, 0)} unit="s" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: '#5a7d6b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Models
            </p>
            {models.length ? models.map((m) => <Chip key={m}>{m}</Chip>)
              : <span style={{ fontSize: 13, color: '#8aab9b' }}>No models loaded</span>}
          </div>
          <div style={{ fontSize: 13, color: '#0f2d1e' }}>
            Faults:{' '}
            <span style={{ fontWeight: 700, color: sim?.faults_enabled ? GREEN : '#8aab9b' }}>
              {sim?.faults_enabled ? 'enabled' : 'disabled'}
            </span>
            {' · '}
            <span style={{ color: activeFaults.length ? '#dc2626' : '#5a7d6b' }}>
              {activeFaults.length} active
            </span>
          </div>
        </div>

        <div style={{ ...card, flex: 1, minWidth: 320 }}>
          <p style={panelTitle}>World State</p>
          {sim?.world_enabled === false ? (
            <span style={{ fontSize: 13, color: '#8aab9b' }}>World simulation disabled</span>
          ) : (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Tile label="Outdoor temp" value={fmt(world.outdoor_temp)} unit="°C" />
              <Tile label="Zone temp" value={fmt(world.zone_temp)} unit="°C" />
              <Tile label="Zone CO₂" value={fmt(world.zone_co2, 0)} unit="ppm" />
              <Tile label="Zone humidity" value={fmt(world.zone_humidity, 0)} unit="%" />
              <Tile label="Occupancy" value={fmt(world.occupancy, 0)} />
            </div>
          )}
        </div>
      </div>

      {/* Device table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <p style={{ ...panelTitle, margin: 0, padding: '16px 20px 0' }}>Devices</p>
        {devices.length === 0 ? (
          <p style={{ padding: 20, color: '#8aab9b', fontSize: 13 }}>No devices found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead>
              <tr style={{ background: '#f3f9f6' }}>
                <th style={th}>Name</th>
                <th style={th}>Device ID</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.device_id}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{d.name || '—'}</div>
                    {d.description && (
                      <div style={{ fontSize: 12, color: '#5a7d6b' }}>{d.description}</div>
                    )}
                  </td>
                  <td style={{ ...td, fontFamily: MONO, color: '#5a7d6b' }}>{d.device_id}</td>
                  <td style={td}><StatusBadge status={d.status} /></td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: MONO }}>{d.point_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
