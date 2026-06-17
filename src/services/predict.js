// Predictive-failure engine (frontend).
//
// PROBLEM: backend raises a `medium` alarm on every P10–P90 forecast breach —
// hundreds of noise alerts on tiny wiggles. That is threshold alerting, not
// prediction.
//
// THIS instead asks: will a point's FORECAST trajectory leave its normal
// operating envelope (toward a breakdown/stop condition) within the horizon?
// Only those are surfaced, ranked by time-to-failure. Approximation of what a
// PdM platform (Presage / Siemens Senseye) does — proper version belongs in
// the backend (sustained-degradation model + per-asset failure limits + RUL).

import { fetchForecast, fetchHistory } from "./api";

// Catastrophic hard limits by unit — known stop/fail bounds, override envelope.
const HARD_LIMITS = {
  degreesCelsius:       { hi: 45,   lo: 0 },     // coil overheat / freeze
  amperes:              { hi: null, lo: null },  // data-driven (overcurrent)
  pascals:              { hi: null, lo: null },  // clogged filter / duct
  partsPerMillion:      { hi: 2000, lo: null },  // ventilation failure (CO2)
  percentRelativeHumidity: { hi: 90, lo: null },
  kilowatts:            { hi: null, lo: null },
  volts:               { hi: null, lo: null },
  hertz:                { hi: null, lo: null },
};

// Which points are worth scanning — rotating/critical analog signals.
const CRIT_NAME = /(temp|current|amp|pressure|fan|speed|power|co2|humid|valve|flow|freq|volt|motor|bearing|vibrat)/i;
const SKIP_NAME = /(setpoint|enable|command|mode|status|dirty)/i;

export function isCritical(p) {
  if (!p || typeof p.value !== "number") return false;       // skip booleans
  if (SKIP_NAME.test(p.point_name)) return false;
  if (!/analog/i.test(p.object_type || "")) return false;
  return CRIT_NAME.test(p.point_name) || p.units in HARD_LIMITS;
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const std  = (a, m) => Math.sqrt(mean(a.map((x) => (x - m) ** 2)));

// Evaluate ONE point. Returns a prediction object or null (healthy).
async function evaluate(point) {
  const name = point.point_name;
  let hist, fc;
  try {
    hist = await fetchHistory(name, { res: "15m", limit: 96 }); // ~24h envelope
    fc   = await fetchForecast(name, { res: "15m", horizon: 16 }); // ~4h ahead
  } catch {
    return null;
  }
  const vals = (hist?.points || [])
    .map((x) => (x.avg ?? x.last ?? x.value))
    .filter((v) => Number.isFinite(v));
  const traj = fc?.forecast || [];
  if (vals.length < 8 || traj.length === 0) return null;

  const m = mean(vals);
  const s = std(vals, m) || Math.abs(m) * 0.02 || 1; // guard zero-variance
  const hard = HARD_LIMITS[point.units] || {};
  // Failure bounds: leave normal envelope (μ±4σ) OR hit a catastrophic limit.
  const hi = Math.min(...[m + 4 * s, hard.hi].filter((x) => x != null));
  const lo = Math.max(...[m - 4 * s, hard.lo].filter((x) => x != null));

  const now = Date.now();
  let breach = null;
  for (const f of traj) {
    const t = new Date(f.time).getTime();
    if (t < now) continue;
    const overHi = f.p50 >= hi, underLo = f.p50 <= lo;
    if (overHi || underLo) {
      // confidence: does the forecast envelope edge cross too?
      const envCross = overHi ? f.p90 >= hi : f.p10 <= lo;
      breach = {
        time: f.time,
        eta: Math.max(0, Math.round((t - now) / 60000)),
        predicted: f.p50,
        bound: overHi ? hi : lo,
        direction: overHi ? "rising" : "falling",
        confidence: envCross ? "high" : "medium",
      };
      break;
    }
  }

  // Degradation watch: no breach yet, but expected value trends hard toward a bound.
  if (!breach) {
    const first = traj[0].p50, last = traj[traj.length - 1].p50;
    const slope = last - first;
    const margin = slope > 0 ? hi - last : last - lo;
    const span = hi - lo;
    if (Math.abs(slope) > 0.5 * s && margin < 0.4 * span) {
      return {
        point: name, device_id: point.device_id, units: point.units,
        current: point.value, predicted: last, bound: slope > 0 ? hi : lo,
        direction: slope > 0 ? "rising" : "falling",
        eta: null, confidence: "low", level: "watch",
        reason: `Trending ${slope > 0 ? "up" : "down"} toward operating limit; not yet projected to breach within horizon.`,
      };
    }
    return null;
  }

  // Severity by time-to-failure.
  const level = breach.eta <= 30 ? "critical" : breach.eta <= 120 ? "high" : "elevated";
  return {
    point: name, device_id: point.device_id, units: point.units,
    current: point.value, predicted: round(breach.predicted), bound: round(breach.bound),
    direction: breach.direction, eta: breach.eta, confidence: breach.confidence, level,
    reason: `Forecast ${breach.direction} to ${round(breach.predicted)}${unit(point.units)} ` +
            `crossing operating limit ${round(breach.bound)}${unit(point.units)} in ~${breach.eta} min.`,
  };
}

const round = (v) => (Number.isInteger(v) ? v : Number(v.toFixed(2)));
const unit  = (u) => (u && u !== "noUnits" ? ` ${u}` : "");

// Scan a list of snapshot points. onProgress(done, total) for UI.
// Runs in small concurrent batches to avoid hammering the forecast model.
export async function scanPredictions(points, { onProgress, batch = 6 } = {}) {
  const crit = points.filter(isCritical);
  const out = [];
  let done = 0;
  for (let i = 0; i < crit.length; i += batch) {
    const slice = crit.slice(i, i + batch);
    const res = await Promise.all(slice.map(evaluate));
    for (const r of res) if (r) out.push(r);
    done += slice.length;
    onProgress?.(done, crit.length);
  }
  // Rank: failures before watches, soonest ETA first, then confidence.
  const rank = { critical: 0, high: 1, elevated: 2, watch: 3 };
  const conf = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) =>
    (rank[a.level] - rank[b.level]) ||
    ((a.eta ?? 1e9) - (b.eta ?? 1e9)) ||
    (conf[a.confidence] - conf[b.confidence])
  );
  return { predictions: out, scanned: crit.length };
}

// Classify a backend alarm as low-value forecast-deviation noise vs real signal.
export function isThresholdNoise(alarm) {
  return (
    alarm.severity === "medium" &&
    /anomaly detected/i.test(alarm.message || "") &&
    /forecast threshold/i.test(alarm.message || "")
  );
}
