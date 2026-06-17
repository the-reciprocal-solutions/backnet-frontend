import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import { fetchKpi, fetchPredictions, fetchAssets, fetchAssetHealth } from '../services/api';

// Predictive-maintenance view — now backed by the SERVER engine
// (/api/predictions, /api/kpi, /api/assets/{id}/health). No client heuristic.

const LEVEL = {
  critical: { color: '#dc2626', bg: '#fef2f2', label: 'CRITICAL' },
  high:     { color: '#ea580c', bg: '#fff7ed', label: 'HIGH' },
  elevated: { color: '#d4a017', bg: '#fef9e8', label: 'ELEVATED' },
  watch:    { color: '#2563eb', bg: '#eff6ff', label: 'WATCH' },
};
const STATUS = {
  Healthy: { color: '#16a34a', bg: '#e8f7ef' },
  Watch:   { color: '#d4a017', bg: '#fef9e8' },
  'At-Risk': { color: '#dc2626', bg: '#fef2f2' },
};
const MONO = "'DM Mono', ui-monospace, monospace";
const card = { background: '#fff', border: '1px solid #e2ede8', borderRadius: 12, padding: 20 };
const th = { textAlign: 'left', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#5a7d6b', fontWeight: 600 };
const td = { padding: '11px 14px', fontSize: 13, color: '#0f2d1e', borderTop: '1px solid #eef5f1' };

const etaLabel = (m) => (m == null ? '—' : m === 0 ? 'now' : m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} h`);

export default function PerformancePage() {
  const [kpi, setKpi] = useState(null);
  const [preds, setPreds] = useState([]);
  const [assets, setAssets] = useState([]);
  const [health, setHealth] = useState({});   // asset_id -> health
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sel, setSel] = useState(null);

  async function load() {
    setError(null);
    try {
      const [k, p, a] = await Promise.all([fetchKpi(), fetchPredictions(), fetchAssets()]);
      setKpi(k); setPreds(Array.isArray(p) ? p : []); setAssets(Array.isArray(a) ? a : []);
      // pull per-asset health in parallel (small N)
      const entries = await Promise.all(
        (a || []).map(as => fetchAssetHealth(as.id).then(h => [as.id, h]).catch(() => [as.id, null]))
      );
      setHealth(Object.fromEntries(entries));
      setLoading(false);
    } catch (err) {
      setError(err.message); setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // refresh every 15s
    return () => clearInterval(t);
  }, []);

  if (loading) return <p style={{ padding: 40, color: '#5a7d6b', fontSize: 14 }}>Loading predictive view…</p>;
  if (error)   return <p style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>Error: {error}</p>;

  const ranked = [...assets].sort((a, b) => (health[a.id]?.score ?? 100) - (health[b.id]?.score ?? 100));
  const selHealth = sel ? health[sel] : null;

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f2d1e' }}>Predictive Maintenance</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5a7d6b' }}>
            Server-side failure prediction — forecast trajectories leaving the operating envelope
          </p>
        </div>
        <button onClick={load} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1a5c3e', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>↻ Refresh</button>
      </div>

      {/* Fleet KPIs */}
      <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
        <StatCard label="Avg Health" value={kpi?.avg_health ?? '—'} sub="0–100 fleet" icon="❤" />
        <StatCard label="Assets At-Risk" value={kpi?.assets_at_risk ?? 0} sub="score < 50" subColor={kpi?.assets_at_risk ? '#dc2626' : '#5a7d6b'} icon="⚠" />
        <StatCard label="Predicted Failures" value={kpi?.predicted_failures ?? 0} sub="active forecast breaches" subColor={kpi?.predicted_failures ? '#ea580c' : '#5a7d6b'} icon="🎯" />
        <StatCard label="Active Alarms" value={kpi?.active_alarms ?? 0} icon="🔔" />
      </div>

      {/* Predicted failures */}
      <div style={{ ...card, marginTop: 20, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef5f1', fontSize: 15, fontWeight: 700, color: '#0f2d1e' }}>
          🎯 Predicted Failures <span style={{ fontSize: 12, fontWeight: 400, color: '#5a7d6b' }}>ranked by time-to-failure</span>
        </div>
        {preds.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 26 }}>✅</div>
            <p style={{ margin: '6px 0 0', color: '#16a34a', fontSize: 14, fontWeight: 600 }}>No failures predicted — all points within normal envelope</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f3f9f6' }}>
              <tr><th style={th}>Severity</th><th style={th}>Point</th><th style={th}>Prediction</th><th style={th}>ETA</th><th style={th}>Confidence</th></tr>
            </thead>
            <tbody>
              {preds.map((p, i) => {
                const s = LEVEL[p.level] || LEVEL.watch;
                return (
                  <tr key={i}>
                    <td style={td}><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, color: s.color, background: s.bg }}>{s.label}</span></td>
                    <td style={{ ...td, fontFamily: MONO, fontWeight: 600 }}>{p.point}<div style={{ fontWeight: 400, fontSize: 11, color: '#8aab9b' }}>dev {p.device_id}</div></td>
                    <td style={{ ...td, color: '#3d6b53', fontSize: 12.5 }}>{p.reason}</td>
                    <td style={{ ...td, fontFamily: MONO, color: s.color, fontWeight: 700 }}>{etaLabel(p.eta_minutes)}</td>
                    <td style={td}><span style={{ fontSize: 11, fontWeight: 600, color: p.confidence === 'high' ? '#dc2626' : p.confidence === 'medium' ? '#d4a017' : '#8aab9b' }}>{p.confidence}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Asset health */}
      <div style={{ ...card, marginTop: 20, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef5f1', fontSize: 15, fontWeight: 700, color: '#0f2d1e' }}>
          Asset Health <span style={{ fontSize: 12, fontWeight: 400, color: '#5a7d6b' }}>worst first · click for detail</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f3f9f6' }}>
            <tr><th style={th}>Asset</th><th style={th}>Class</th><th style={th}>Health</th><th style={th}>Status</th><th style={th}>RUL</th><th style={th}>Alarms</th></tr>
          </thead>
          <tbody>
            {ranked.map(a => {
              const h = health[a.id];
              const st = STATUS[h?.status] || STATUS.Healthy;
              return (
                <tr key={a.id} onClick={() => setSel(sel === a.id ? null : a.id)} style={{ cursor: 'pointer', background: sel === a.id ? '#f3f9f6' : 'transparent' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{a.name}</td>
                  <td style={{ ...td, color: '#5a7d6b' }}>{a.asset_class}</td>
                  <td style={{ ...td, fontFamily: MONO, fontWeight: 700, color: st.color }}>{h ? h.score : '—'}</td>
                  <td style={td}><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, color: st.color, background: st.bg }}>{h?.status || '—'}</span></td>
                  <td style={{ ...td, fontFamily: MONO }}>{h?.rul_minutes != null ? etaLabel(h.rul_minutes) : '—'}</td>
                  <td style={{ ...td, fontFamily: MONO }}>{h?.active_alarms ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected asset detail */}
      {selHealth && (
        <div style={{ ...card, marginTop: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f2d1e', marginBottom: 8 }}>{selHealth.name} — detail</div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#3d6b53', marginBottom: 10 }}>
            <span>Score <b style={{ color: (STATUS[selHealth.status] || STATUS.Healthy).color }}>{selHealth.score}</b></span>
            <span>Status <b>{selHealth.status}</b></span>
            <span>RUL <b>{selHealth.rul_minutes != null ? etaLabel(selHealth.rul_minutes) : '—'}</b></span>
            <span>Active alarms <b>{selHealth.active_alarms}</b></span>
          </div>
          {selHealth.predictions?.length ? selHealth.predictions.map((p, i) => (
            <div key={i} style={{ fontSize: 12.5, color: '#5a7d6b', padding: '4px 0', borderTop: '1px solid #f0f5f2', fontFamily: MONO }}>
              {p.point} — {p.reason}
            </div>
          )) : <p style={{ fontSize: 13, color: '#8aab9b', margin: 0 }}>No active predictions for this asset.</p>}
        </div>
      )}
    </div>
  );
}
