// Central API client. BASE_URL empty → calls hit /api/* and Vite (dev) or
// nginx (prod) proxies to the backend. Auth header injected per request from
// the runtime auth module — no credentials baked into this bundle.

import { getAuthHeader, clearAuth } from "./auth";

const BASE_URL = ""; // same-origin; proxy handles /api → backend

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Single fetch wrapper: injects auth, parses JSON, normalizes errors.
// On 401 it clears auth and signals the app to bounce to login.
async function fetchJson(path, { method = "GET", body, headers = {}, signal } = {}) {
  const auth = getAuthHeader();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    signal,
    headers: {
      ...(auth ? { Authorization: auth } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearAuth();
    window.dispatchEvent(new Event("auth:expired"));
    throw new ApiError("Unauthorized", 401);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch { /* non-JSON body */ }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}

export { ApiError };

// ---- Health ----------------------------------------------------------------
export const fetchHealth = (opts) => fetchJson("/api/health", opts);

// ---- Devices ---------------------------------------------------------------
export const fetchDevices = (opts) => fetchJson("/api/devices", opts);
export const fetchDeviceDetail = (id, opts) => fetchJson(`/api/devices/${id}`, opts);
export const writePointValue = (id, point_name, value) =>
  fetchJson(`/api/devices/${id}/points`, { method: "PUT", body: { point_name, value } });

// ---- Alarms / Events -------------------------------------------------------
export const fetchAlarms = (activeOnly = false, limit = 100) =>
  fetchJson(`/api/alarms?active_only=${activeOnly}&limit=${limit}`);
export const fetchEvents = (limit = 50) => fetchJson(`/api/events?limit=${limit}`);

// ---- Scenarios -------------------------------------------------------------
export const fetchScenarios = () => fetchJson("/api/scenarios");
export const startScenario = (id, params = {}) =>
  fetchJson(`/api/scenarios/${id}/start`, { method: "POST", body: { params } });
export const stopScenario = (id) =>
  fetchJson(`/api/scenarios/${id}/stop`, { method: "POST" });

// ---- Simulation ------------------------------------------------------------
export const fetchSimStatus = () => fetchJson("/api/simulation/status");
export const fetchGenerators = () => fetchJson("/api/simulation/generators");
export const fetchSnapshot = () => fetchJson("/api/simulation/snapshot");
export const fetchFaults = () => fetchJson("/api/simulation/faults");
export const injectFault = (point_key, kind, duration_s = 0, params = {}) =>
  fetchJson("/api/simulation/faults", { method: "POST", body: { point_key, kind, duration_s, params } });
export const clearFaults = (pointKey) =>
  fetchJson(`/api/simulation/faults${pointKey ? `?point_key=${encodeURIComponent(pointKey)}` : ""}`, { method: "DELETE" });

// ---- History ---------------------------------------------------------------
export const fetchHistory = (point, { res = "1m", from, to, limit = 500 } = {}) => {
  const q = new URLSearchParams({ res, limit });
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return fetchJson(`/api/history/${point}?${q}`);
};
export const fetchLatestPerDevice = () => fetchJson("/api/history/devices/latest");

// ---- Forecast --------------------------------------------------------------
export const fetchForecastInfo = () => fetchJson("/api/forecast/info");
export const fetchForecast = (point, { res = "1m", horizon = 12, lookback_s = 3600 } = {}) =>
  fetchJson(`/api/forecast/${point}?res=${res}&horizon=${horizon}&lookback_s=${lookback_s}`);

// ---- Copilot ---------------------------------------------------------------
export const fetchCopilotInfo = () => fetchJson("/api/copilot/info");
export const explainPoint = (point, { horizon = 6, res = "1m", window_s = 1800 } = {}) =>
  fetchJson(`/api/copilot/explain/${point}?horizon=${horizon}&res=${res}&window_s=${window_s}`);
export const askCopilot = (question, object_name = null) =>
  fetchJson("/api/copilot/ask", { method: "POST", body: { question, object_name } });
export const copilotAsk = askCopilot; // alias used by LLMChat

// ---- Assets / Predictions / Health / KPI (PdM) -----------------------------
export const fetchAssets = () => fetchJson("/api/assets");
export const fetchAsset = (id) => fetchJson(`/api/assets/${id}`);
export const createAsset = (body) => fetchJson("/api/assets", { method: "POST", body });
export const updateAsset = (id, body) => fetchJson(`/api/assets/${id}`, { method: "PUT", body });
export const deleteAsset = (id) => fetchJson(`/api/assets/${id}`, { method: "DELETE" });
export const fetchAssetHealth = (id) => fetchJson(`/api/assets/${id}/health`);
export const fetchPredictions = () => fetchJson("/api/predictions");
export const fetchKpi = () => fetchJson("/api/kpi");

// ---- Webhook endpoints -----------------------------------------------------
export const fetchEndpoints = () => fetchJson("/api/endpoints");
export const createEndpoint = (url, event_types = null) =>
  fetchJson("/api/endpoints", { method: "POST", body: { url, event_types } });
export const deleteEndpoint = (id) => fetchJson(`/api/endpoints/${id}`, { method: "DELETE" });
export const testEndpoint = (id) => fetchJson(`/api/endpoints/${id}/test`, { method: "POST" });

// ---- SSE live stream -------------------------------------------------------
// EventSource can't send the Basic auth header, so we consume the SSE endpoint
// with fetch + a streaming reader and parse `data:` frames ourselves.
// Returns an unsubscribe fn. Auto-reconnects with backoff on drop.
export function streamSnapshots(onData, onError) {
  const controller = new AbortController();
  let stopped = false;
  let backoff = 1000;

  async function run() {
    while (!stopped) {
      try {
        const res = await fetch("/api/simulation/stream", {
          headers: { Authorization: getAuthHeader() || "" },
          signal: controller.signal,
        });
        if (res.status === 401) { clearAuth(); window.dispatchEvent(new Event("auth:expired")); return; }
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);

        backoff = 1000; // reset after a good connect
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) !== -1) {
            const frame = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (line) {
              try { onData(JSON.parse(line.slice(5).trim())); } catch { /* skip bad frame */ }
            }
          }
        }
      } catch (err) {
        if (stopped || controller.signal.aborted) return;
        onError?.(err);
      }
      if (stopped) return;
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, 15000);
    }
  }
  run();

  return () => { stopped = true; controller.abort(); };
}
