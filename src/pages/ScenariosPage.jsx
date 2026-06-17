import React, { useState, useEffect } from 'react';
import { fetchScenarios, startScenario, stopScenario } from '../services/api';

const STATUS_COLOR = {
  running: '#16a34a',
  stopped: '#8aab9b',
};

const SCENARIO_DESC = {
  hvac_day_cycle:   'Simulates a compressed 24-hour HVAC day/night cycle with temperature, humidity, and CO₂ variations.',
  alarm_cycle:      'Triggers a sequence of alarms across devices — useful for testing alarm workflows.',
  device_offline:   'Takes one or more devices offline temporarily to simulate network failure.',
  manual_override:  'Applies manual override values to selected points, bypassing automation logic.',
};

const SCENARIO_ICON = {
  hvac_day_cycle:  '❄',
  alarm_cycle:     '!',
  device_offline:  'X',
  manual_override: 'M',
};

export default function ScenariosPage() {
  const [scenarios,  setScenarios]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [actionId,   setActionId]   = useState(null); // which scenario is mid-action
  const [toast,      setToast]      = useState(null); // success/error message

  function loadScenarios() {
    setLoading(true);
    fetchScenarios()
      .then(data => { setScenarios(data); setLoading(false); })
      .catch(err  => { setError(err.message); setLoading(false); });
  }

  useEffect(() => { loadScenarios(); }, []);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleStart(scenarioId) {
    setActionId(scenarioId);
    try {
      await startScenario(scenarioId);
      showToast(`Scenario "${scenarioId}" started successfully`);
      loadScenarios(); // refresh status
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setActionId(null);
    }
  }

  async function handleStop(scenarioId) {
    setActionId(scenarioId);
    try {
      await stopScenario(scenarioId);
      showToast(`Scenario "${scenarioId}" stopped`);
      loadScenarios();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setActionId(null);
    }
  }

  const running = scenarios.filter(s => s.status === 'running').length;
  const stopped = scenarios.filter(s => s.status === 'stopped').length;

  if (error) return <p style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>Error: {error}</p>;

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 999,
          background: toast.isError ? '#dc2626' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f2d1e' }}>Scenarios</h1>
        <button
          onClick={loadScenarios}
          style={{ padding: '6px 14px', background: '#1a5c3e', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
        {[
          ['Total Scenarios', scenarios.length, '#0f2d1e'],
          ['Running',         running,          '#16a34a'],
          ['Stopped',         stopped,          '#8aab9b'],
        ].map(([label, count, color]) => (
          <div key={label} style={{ flex: 1, background: '#fff', border: '1px solid #e2ede8', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, color: '#8aab9b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color }}>{loading ? '...' : count}</p>
          </div>
        ))}
      </div>

      {/* Scenario Cards */}
      {loading ? (
        <p style={{ fontSize: 14, color: '#8aab9b' }}>Loading scenarios...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {scenarios.map(s => {
            const isRunning   = s.status === 'running';
            const isActing    = actionId === s.id;
            const icon        = SCENARIO_ICON[s.id] || 'S';
            const description = SCENARIO_DESC[s.id] || s.description;

            return (
              <div key={s.id} style={{
                background: '#fff',
                border: `1px solid ${isRunning ? '#16a34a44' : '#e2ede8'}`,
                borderLeft: `4px solid ${isRunning ? '#16a34a' : '#c8ddd2'}`,
                borderRadius: 12,
                padding: '20px 24px',
              }}>
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: isRunning ? '#e8f4ef' : '#f0f5f2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, color: isRunning ? '#1a5c3e' : '#8aab9b', fontWeight: 700,
                    }}>
                      {icon}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f2d1e' }}>{s.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#8aab9b', fontFamily: 'monospace' }}>{s.id}</p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span style={{
                    background: (STATUS_COLOR[s.status] || '#8aab9b') + '22',
                    color: STATUS_COLOR[s.status] || '#8aab9b',
                    padding: '4px 12px', borderRadius: 20,
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  }}>
                    {s.status}
                  </span>
                </div>

                {/* Description */}
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#5a7d6b', lineHeight: 1.5 }}>
                  {description}
                </p>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {!isRunning ? (
                    <button
                      onClick={() => handleStart(s.id)}
                      disabled={isActing}
                      style={{
                        flex: 1, padding: '9px 0',
                        background: isActing ? '#5a7d6b' : '#1a5c3e',
                        color: '#fff', border: 'none', borderRadius: 8,
                        fontSize: 13, fontWeight: 600, cursor: isActing ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isActing ? 'Starting...' : 'Start'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStop(s.id)}
                      disabled={isActing}
                      style={{
                        flex: 1, padding: '9px 0',
                        background: isActing ? '#9ca3af' : '#dc2626',
                        color: '#fff', border: 'none', borderRadius: 8,
                        fontSize: 13, fontWeight: 600, cursor: isActing ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isActing ? 'Stopping...' : 'Stop'}
                    </button>
                  )}

                  <button
                    onClick={() => loadScenarios()}
                    style={{
                      padding: '9px 16px',
                      background: '#fff', color: '#3d6b53',
                      border: '1px solid #c8ddd2', borderRadius: 8,
                      fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Status
                  </button>
                </div>

                {/* Running indicator */}
                {isRunning && (
                  <div style={{
                    marginTop: 12, padding: '8px 12px',
                    background: '#e8f4ef', borderRadius: 7,
                    fontSize: 12, color: '#1a5c3e', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: '#16a34a', display: 'inline-block',
                    }} />
                    Scenario is currently running
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div style={{
        marginTop: 24, background: '#f8faf9',
        border: '1px solid #e2ede8', borderRadius: 12, padding: '16px 20px',
        fontSize: 13, color: '#5a7d6b', lineHeight: 1.6,
      }}>
        <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#0f2d1e' }}>About Scenarios</p>
        <p style={{ margin: 0 }}>
          Scenarios simulate real-world BACnet events for testing and demonstration.
          Starting a scenario pushes live data changes to your devices — alarms will fire,
          point values will change, and events will appear in the Event Log in real time.
        </p>
      </div>
    </div>
  );
}
