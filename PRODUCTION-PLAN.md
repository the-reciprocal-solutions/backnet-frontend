# Production Plan — BACnet PdM Dashboard

Backend wired (FastAPI @ `bacnet.tools.thefusionapps.com`, TimescaleDB, Chronos, SSE, webhooks, Prometheus). Frontend = React 18 + Vite. Goal: ship production-grade PdM app for Building Facility Management.

This plan = 3 parts: **(A)** reconcile frontend ↔ real backend, **(B)** backend gaps to add, **(C)** production-readiness (security/deploy/ops/test).

---

## Backend reality check (correct earlier assumptions)

Backend ALREADY has (no need to build):
- **Live data**: `/api/simulation/snapshot` (all points flat), `/api/simulation/stream` (**SSE ~1s**), `/api/history/{point}` (raw/1m/15m/1h + avg/min/max/n), `/api/history/devices/latest` (pivoted)
- **Forecast**: `/api/forecast/{point}` Chronos p10/p50/p90, `/forecast/info`
- **Anomaly**: auto-detect — value outside forecast P10–P90 → `alarm_raised severity:medium`. Poll `/api/alarms` or webhook.
- **Faults**: inject `stuck/spike/drift/offline/noise_burst` (`/api/simulation/faults`) — demo/test PdM
- **Copilot**: `/api/copilot/explain/{point}`, `/ask` — grounded forecast+reason+LLM
- **Webhooks**: HMAC, event types incl `alarm_raised/cleared`, `device_status_changed`
- **Sim control**: status/generators/start/stop
- **Metrics**: Prometheus `/metrics`

Backend MISSING (PdM intelligence + ops layer):
- ❌ Asset registry (class, make/model, install date, criticality, run-hours, location)
- ❌ Health-score per asset, ❌ RUL, ❌ fault classification (unbalance/bearing/misalign)
- ❌ Work-order / CMMS, ❌ maintenance schedule
- ❌ Energy KPI (kWh, kW/ton, baseline)
- ❌ Fleet KPI (MTBF/MTTR/availability/downtime-avoided/cost-saved)
- ❌ Users/RBAC (only HTTP Basic `admin:admin123`)

---

## A. Frontend ↔ backend wiring (do first — high ROI, backend ready)

`src/services/api.js` currently covers: health, devices, device detail, write-point, alarms, events, scenarios. **Extend api.js** to add: snapshot, **SSE stream**, history, history/latest, forecast, copilot, faults, sim-status, endpoints(webhooks), metrics.

| Tab | Real endpoint to wire | Replaces |
|-----|----------------------|----------|
| Dashboard | `/history/devices/latest`, `/alarms`, SSE stream | mock `LINE_SERIES` |
| Live Points (stub) | **SSE** `/simulation/stream` + `/snapshot` | build live grid |
| Object Explorer (stub) | `/devices/{id}`, `/simulation/generators` | build tree |
| Trends | `/history/{point}` + `/forecast/{point}` + **anomaly band already p10/p90** | already partial |
| Alarms | `/alarms` (anomaly alarms already flow here) | add ack/WO actions |
| Performance (stub) | derive from `/forecast` + `/alarms` + faults until health/RUL endpoint exists | new |
| Schedules | `/scenarios` (sim) — keep; add CMMS later | — |
| Network (stub) | `/simulation/status`, `/devices` status, `/metrics` | build |
| Settings (stub) | `/api/endpoints` (webhook mgmt), `/forecast/info`, `/copilot/info` | build |

**SSE wiring** (Live Points / Dashboard live):
```js
const es = new EventSource("/api/simulation/stream");
es.onmessage = e => setPoints(JSON.parse(e.data));
es.onerror = () => { es.close(); /* backoff reconnect */ };
```
Note: `EventSource` can't set Basic Auth header → relies on page session/cookie OR move to token in query. See security §C.1.

---

## B. Backend additions (PdM core — sequence)

New endpoints (FastAPI), TimescaleDB-backed where time-series:

1. **Asset model** — `GET /api/assets`, `GET /api/assets/{id}`
   - Maps BACnet device/points → physical asset (AHU/pump/chiller), criticality, run-hours (from history), metadata
2. **Health score** — `GET /api/assets/{id}/health`
   - Derive from anomaly rate + forecast-interval breaches (data already in DB). Score 0–100 + status.
3. **RUL** — `GET /api/assets/{id}/rul`
   - Trend-extrapolate degradation signal; reuse Chronos forecast horizon.
4. **Fault classification** — `GET /api/faults/classify/{point}`
   - Map signal pattern → unbalance/misalignment/bearing/looseness (rules first, ML later).
5. **Work-orders / CMMS** — `GET/POST/PATCH /api/workorders` (create from alarm, assign, close); `GET /api/maintenance/schedule`. Webhook → auto-WO (Siemens SAP-PM pattern).
6. **Energy** — `GET /api/energy` (kWh, kW/ton, baseline vs actual; anomaly = early fault)
7. **Fleet KPI** — `GET /api/kpi` (MTBF, MTTR, availability, downtime-avoided, cost-saved)
8. **Auth/RBAC** — `/api/auth/login` (JWT), `/api/users`, `/api/roles`. Retire shared Basic creds.

Frontend stub-then-swap: build tab UI against mock matching schema → flip to live when endpoint lands.

---

## C. Production-readiness checklist

### C.1 Security (blockers — fix before prod)
- 🔴 **Remove hardcoded `admin:admin123`** from frontend ([api.js](src/services/api.js) `btoa("admin:admin123")`). Move to login → JWT/session. Never ship creds in JS bundle.
- 🔴 Backend: enforce `BACNET_LAB_AUTH_*`, rotate, per-user creds, not shared admin.
- SSE auth: use httpOnly cookie session OR short-lived token query param (Basic header unsupported by EventSource).
- HTTPS only (already via openresty). HSTS, secure cookies.
- CORS: lock `allowedHosts` + backend CORS to known origins (done in vite for dev host).
- Secrets: `.env` (VITE_*) only non-secret config; real secrets server-side. `.env` gitignored ✓.
- Webhook HMAC verify on consumers. RBAC: technician vs admin vs viewer (write-point + WO = privileged).
- Rate-limit + input-validate write-point / fault-inject (don't expose fault injection in prod UI, or gate behind admin).

### C.2 Frontend robustness
- Loading / empty / **error states** every data tab (backend 401/404/502 already seen — handle gracefully)
- Central fetch wrapper: auth header, retry/backoff, timeout, error toast (replace per-fn `throw new Error`)
- SSE reconnect w/ exponential backoff; fall back to `/snapshot` poll
- Error boundary per route; global 401 → redirect login
- Loading skeletons; no layout shift
- Remove mock data (`mockData.js`) once wired
- Strip `console.log` (LLMChat logs URL/KEY — **leak risk**, remove)

### C.3 Build & deploy
- **Prod = static build**, not dev server. `npm run build` → `dist/` → serve via openresty/nginx (NOT `vite` pm2 dev).
- Current pm2 runs `vite` dev (HMR, unminified) — **switch to** `vite preview` or static nginx for prod.
- nginx: serve `dist/`, SPA fallback `try_files $uri /index.html`, proxy `/api` → backend, gzip/brotli, cache-bust hashed assets.
- Multi-stage Dockerfile (node build → nginx serve). docker-compose alongside backend.
- Env per stage: dev/staging/prod `VITE_*`, backend URL via build-time env.
- pm2: if keep node, run preview server + `pm2 save` + `pm2 startup` (reboot persist).

### C.4 Observability & ops
- Backend `/metrics` (Prometheus) ✓ — add Grafana dashboards (sim ticks, anomaly rate, forecast latency)
- Frontend: error tracking (Sentry), web-vitals
- Health checks: `/api/health`, `/api/forecast/info`, `/api/copilot/info` → status page tab
- Structured logs, request IDs, alert on 502/forecast-down

### C.5 Quality gates
- Tests: unit (api wrapper, health calc), component (Vitest + RTL), e2e (Playwright — login→dashboard→trend)
- Lint + format (ESLint + Prettier), pre-commit hook
- CI: install → lint → test → build → deploy (GitHub Actions)
- Type safety: migrate to TypeScript OR PropTypes/JSDoc (catches API-shape drift)
- Accessibility: keyboard nav, ARIA, contrast (currently inline-style only)
- Perf: code-split routes (`React.lazy`), memo charts, virtualize long tables (devices/events)

---

## Phased rollout

| Phase | Scope | Exit criteria |
|-------|-------|--------------|
| **P0 Harden** | Remove hardcoded creds, login+JWT, error/loading states, central fetch, kill console leaks | No secrets in bundle; graceful failures |
| **P1 Wire live** | Extend api.js; SSE Live Points; real Dashboard/Trends; Object Explorer; Network/Settings from existing endpoints | All non-PdM tabs on live data |
| **P2 PdM core** | Backend: assets, health, RUL, fault-class → Performance tab, Devices health col, predictive Alerts | Health+RUL per asset visible |
| **P3 Maintenance** | Work-orders/CMMS, alarm→WO, PM schedule, Energy KPI, Reports, Fleet KPI Dashboard | Full PdM loop: detect→WO→close |
| **P4 Prod ops** | Static build + nginx/Docker, CI/CD, tests, monitoring, RBAC | Deployed, tested, observable |

**Start P0** — security blockers ship-stoppers, independent of backend work.

---

## Immediate next actions
1. Remove `admin:admin123` + console.log from [src/services/api.js](src/services/api.js) + [src/components/LLMChat.jsx](src/components/LLMChat.jsx)
2. Extend api.js: add history/forecast/snapshot/SSE/copilot/faults/webhooks wrappers
3. Central `fetchJson()` wrapper w/ auth + error handling
4. Build **Live Points** (SSE) — fastest live win, backend fully ready
5. Switch pm2 from `vite` dev → prod build serve

Refs: [backend-api.md](backend-api.md), [IMPLEMENTATION.md](IMPLEMENTATION.md), [Siemens Sachsenmilch PdM](https://www.siemens.com/en-us/company/insights/sachsenmilch-dairy-predictive-maintenance/)
