import React, { useEffect, useState, useCallback } from 'react';
import StatCard from '../components/StatCard';
import {
  fetchEndpoints,
  createEndpoint,
  deleteEndpoint,
  testEndpoint,
  fetchForecastInfo,
  fetchCopilotInfo,
  fetchSimStatus,
  ApiError,
} from '../services/api';

const GREEN = '#1a5c3e';
const ACTIVE = '#e8f4ef';
const MUTED = '#5a7d6b';
const BORDER = '#e2ede8';
const DANGER = '#dc2626';
const AMBER = '#b45309';

const EVENT_TYPES = [
  'point_value_changed',
  'device_status_changed',
  'alarm_raised',
  'alarm_cleared',
  'scenario_started',
  'scenario_stopped',
  'telemetry_snapshot',
];

const cardStyle = {
  background: '#fff',
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: 20,
};

const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function StatusBadge({ ok, okLabel, badLabel, badColor }) {
  return (
    <span style={{ color: ok ? GREEN : (badColor || AMBER), fontWeight: 600, fontSize: 13 }}>
      {ok ? '✓ ' : '⚠ '}{ok ? okLabel : badLabel}
    </span>
  );
}

export default function SettingsPage() {
  const [forecast, setForecast] = useState(null);
  const [copilot, setCopilot] = useState(null);
  const [sim, setSim] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(null);

  const [endpoints, setEndpoints] = useState([]);
  const [hooksLoading, setHooksLoading] = useState(true);
  const [hooksError, setHooksError] = useState(null);

  const [url, setUrl] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState(null);
  const [secretRevealed, setSecretRevealed] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, kind) => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const [f, c, s] = await Promise.all([
        fetchForecastInfo(),
        fetchCopilotInfo(),
        fetchSimStatus(),
      ]);
      setForecast(f);
      setCopilot(c);
      setSim(s);
    } catch (err) {
      setStatusError(err && err.message ? err.message : 'Failed to load service status');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadEndpoints = useCallback(async () => {
    setHooksLoading(true);
    setHooksError(null);
    try {
      const data = await fetchEndpoints();
      setEndpoints(Array.isArray(data) ? data : []);
    } catch (err) {
      setHooksError(err && err.message ? err.message : 'Failed to load endpoints');
    } finally {
      setHooksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadEndpoints();
  }, [loadStatus, loadEndpoints]);

  const toggleType = (t) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      showToast('URL is required', 'error');
      return;
    }
    setCreating(true);
    setNewSecret(null);
    setSecretRevealed(false);
    try {
      const eventTypes = selectedTypes.length ? selectedTypes : null;
      const created = await createEndpoint(trimmed, eventTypes);
      if (created && created.secret) {
        setNewSecret(created.secret);
      }
      setUrl('');
      setSelectedTypes([]);
      showToast('Endpoint created', 'ok');
      await loadEndpoints();
    } catch (err) {
      showToast(err && err.message ? err.message : 'Failed to create endpoint', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleTest = async (id) => {
    try {
      const res = await testEndpoint(id);
      if (res && res.status === 'ok') {
        showToast('Test delivered (ok)', 'ok');
      } else {
        showToast('Test completed', 'ok');
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 502) {
        showToast('Delivery failed', 'error');
      } else {
        showToast(err && err.message ? err.message : 'Delivery failed', 'error');
      }
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteEndpoint(id);
      showToast('Endpoint deleted', 'ok');
      await loadEndpoints();
    } catch (err) {
      showToast(err && err.message ? err.message : 'Failed to delete endpoint', 'error');
    }
  };

  const copySecret = async () => {
    if (!newSecret) return;
    try {
      await navigator.clipboard.writeText(newSecret);
      showToast('Secret copied', 'ok');
    } catch (_) {
      showToast('Copy failed', 'error');
    }
  };

  const th = {
    textAlign: 'left',
    padding: '10px 14px',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: MUTED,
    fontWeight: 600,
  };
  const td = {
    padding: '12px 14px',
    fontSize: 13,
    color: '#0f2d1e',
    borderTop: `1px solid #eef5f1`,
    verticalAlign: 'middle',
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f2d1e', margin: 0 }}>Settings</h1>
      <p style={{ fontSize: 13, color: MUTED, margin: '4px 0 24px' }}>
        System services and webhook endpoint management.
      </p>

      {/* Service status */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f2d1e', margin: '0 0 12px' }}>
        Service status
      </h2>
      {statusLoading ? (
        <p style={{ padding: 40, textAlign: 'center', color: MUTED }}>Loading service status...</p>
      ) : statusError ? (
        <p style={{ padding: 40, textAlign: 'center', color: DANGER }}>{statusError}</p>
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
          <StatCard
            label="Forecast"
            value={forecast ? forecast.model_name : '—'}
            sub={
              forecast
                ? `${forecast.chronos_available ? '✓ chronos' : '⚠ fallback'} · ${forecast.db_ready ? 'db ready' : 'db not ready'}`
                : ''
            }
            subColor={forecast && forecast.chronos_available && forecast.db_ready ? GREEN : AMBER}
            icon="\u{1F4C8}"
          />
          <StatCard
            label="Copilot"
            value={copilot ? (copilot.enabled ? 'Enabled' : 'Disabled') : '—'}
            sub={
              copilot
                ? `${copilot.llm_model || '—'} · ${copilot.db_ready ? 'db ready' : 'db not ready'}`
                : ''
            }
            subColor={copilot && copilot.enabled && copilot.db_ready ? GREEN : AMBER}
            icon="\u{1F916}"
          />
          <StatCard
            label="Simulation"
            value={sim ? (sim.running ? 'Running' : 'Stopped') : '—'}
            sub={sim && sim.running ? '✓ active' : '⚠ idle'}
            subColor={sim && sim.running ? GREEN : AMBER}
            icon="\u{1F501}"
          />
        </div>
      )}

      {/* Detail rows for status */}
      {!statusLoading && !statusError && (
        <div style={{ ...cardStyle, marginBottom: 32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div>
              <p style={{ ...th, padding: 0, marginBottom: 6 }}>Forecast</p>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#0f2d1e' }}>
                Model: <span style={{ fontFamily: mono }}>{forecast.model_name}</span>
              </p>
              <p style={{ margin: '0 0 4px' }}>
                <StatusBadge ok={forecast.chronos_available} okLabel="Chronos available" badLabel="Fallback model" />
              </p>
              <p style={{ margin: 0 }}>
                <StatusBadge ok={forecast.db_ready} okLabel="DB ready" badLabel="DB not ready" badColor={DANGER} />
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: MUTED }}>
                Resolutions: {(forecast.resolutions || []).join(', ') || '—'}
              </p>
            </div>
            <div>
              <p style={{ ...th, padding: 0, marginBottom: 6 }}>Copilot</p>
              <p style={{ margin: '0 0 4px' }}>
                <StatusBadge ok={copilot.enabled} okLabel="Enabled" badLabel="Disabled" />
              </p>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#0f2d1e' }}>
                Model: <span style={{ fontFamily: mono }}>{copilot.llm_model || '—'}</span>
              </p>
              <p style={{ margin: '0 0 4px', fontSize: 12, color: MUTED, fontFamily: mono, wordBreak: 'break-all' }}>
                {copilot.base_url || '—'}
              </p>
              <p style={{ margin: 0 }}>
                <StatusBadge ok={copilot.db_ready} okLabel="DB ready" badLabel="DB not ready" badColor={DANGER} />
              </p>
            </div>
            <div>
              <p style={{ ...th, padding: 0, marginBottom: 6 }}>Simulation</p>
              <p style={{ margin: 0 }}>
                <StatusBadge ok={sim.running} okLabel="Running" badLabel="Stopped" />
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f2d1e', margin: '0 0 12px' }}>
        Webhook endpoints
      </h2>

      <div style={{ ...cardStyle, padding: 0, marginBottom: 20, overflow: 'hidden' }}>
        {hooksLoading ? (
          <p style={{ padding: 40, textAlign: 'center', color: MUTED }}>Loading endpoints...</p>
        ) : hooksError ? (
          <p style={{ padding: 40, textAlign: 'center', color: DANGER }}>{hooksError}</p>
        ) : endpoints.length === 0 ? (
          <p style={{ padding: 40, textAlign: 'center', color: MUTED }}>No webhook endpoints configured.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f3f9f6' }}>
              <tr>
                <th style={th}>URL</th>
                <th style={th}>Event types</th>
                <th style={th}>Enabled</th>
                <th style={th}>Failures</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr key={ep.id}>
                  <td style={{ ...td, fontFamily: mono, wordBreak: 'break-all', maxWidth: 280 }}>{ep.url}</td>
                  <td style={td}>
                    {ep.event_types && ep.event_types.length
                      ? ep.event_types.join(', ')
                      : <span style={{ color: MUTED }}>all</span>}
                  </td>
                  <td style={td}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: ep.enabled ? ACTIVE : '#f3f4f6',
                      color: ep.enabled ? GREEN : MUTED,
                    }}>
                      {ep.enabled ? 'enabled' : 'disabled'}
                    </span>
                  </td>
                  <td style={{ ...td, color: ep.failure_count > 0 ? DANGER : '#0f2d1e' }}>
                    {ep.failure_count}
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => handleTest(ep.id)}
                      style={{
                        background: GREEN,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginRight: 8,
                      }}
                    >
                      Test
                    </button>
                    <button
                      onClick={() => handleDelete(ep.id)}
                      style={{
                        background: 'transparent',
                        color: DANGER,
                        border: 'none',
                        padding: '6px 8px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Generated secret */}
      {newSecret && (
        <div style={{ ...cardStyle, marginBottom: 20, background: ACTIVE, borderColor: GREEN }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: GREEN }}>
            Endpoint secret (shown once)
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <code style={{
              fontFamily: mono,
              fontSize: 13,
              background: '#fff',
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: '6px 10px',
              wordBreak: 'break-all',
            }}>
              {secretRevealed ? newSecret : '•'.repeat(Math.min(newSecret.length, 32))}
            </code>
            <button
              onClick={() => setSecretRevealed((v) => !v)}
              style={{ background: 'transparent', color: GREEN, border: `1px solid ${GREEN}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {secretRevealed ? 'Hide' : 'Reveal'}
            </button>
            <button
              onClick={copySecret}
              style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#0f2d1e' }}>Add endpoint</p>
        <form onSubmit={handleCreate}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: mono,
              fontSize: 13,
              padding: '10px 12px',
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              marginBottom: 14,
            }}
          />
          <p style={{ ...th, padding: 0, marginBottom: 8 }}>
            Event types (none selected = all)
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {EVENT_TYPES.map((t) => {
              const on = selectedTypes.includes(t);
              return (
                <button
                  type="button"
                  key={t}
                  onClick={() => toggleType(t)}
                  style={{
                    background: on ? ACTIVE : '#fff',
                    color: on ? GREEN : MUTED,
                    border: `1px solid ${on ? GREEN : BORDER}`,
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: mono,
                  }}
                >
                  {on ? '✓ ' : ''}{t}
                </button>
              );
            })}
          </div>
          <button
            type="submit"
            disabled={creating}
            style={{
              background: GREEN,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: creating ? 'default' : 'pointer',
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? 'Creating...' : 'Create endpoint'}
          </button>
        </form>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: toast.kind === 'error' ? DANGER : GREEN,
          color: '#fff',
          padding: '12px 18px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          zIndex: 1000,
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
