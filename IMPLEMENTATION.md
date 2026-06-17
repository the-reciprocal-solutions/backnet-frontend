# BACnet BMS → Predictive Maintenance for Building Facility Management

Implementation roadmap. Current state per tab + missing PdM features to extend.

**Goal:** turn live BACnet monitoring tool into condition-based PdM platform (health score → RUL → anomaly → work-order), modeled on Siemens Senseye (Sachsenmilch dairy case).

**Stack:** React 18 + Vite, react-router-dom v6, Recharts. API via `src/services/api.js` (proxy `/api` → backend). LLM copilot already wired (`/api/copilot`).

Legend: ✅ done · 🟡 partial · ❌ stub (PlaceholderPage) · ➕ new feature to add

---

## PdM domain model (reference)

Asset types (BFM): AHU/RTU fans+motors, chillers, CHW/HW/domestic pumps, cooling towers, boilers, VFDs/motors, elevators, gensets, UPS battery.

PdM signals: vibration, motor current/signature, bearing temp, pressure/flow, filter ΔP, kW/ton, run-hours, cycle count, battery SoH.

Analytics layer: learn-normal → anomaly deviation → **health score** → **RUL** → fault classification (unbalance/misalignment/bearing/looseness) → condition-based alert → **work-order to CMMS/SAP PM** → maintenance copilot.

---

## API status

**Exists:** `/api/health`, `/api/devices`, `/api/devices/{id}`, `PUT /api/devices/{id}/points`, `/api/alarms`, `/api/events`, `/api/scenarios` (+start/stop), `/api/simulation/snapshot`, `/api/history/{point}`, `/api/forecast/{point}`, `/api/copilot/*`.

**Missing backend (PdM core) — must add:**
- `GET /api/assets` — asset registry (class, make/model, install date, criticality, location, run-hours)
- `GET /api/assets/{id}/health` — health score + RUL + status
- `GET /api/assets/{id}/anomalies` — anomaly events vs learned-normal
- `GET /api/faults/{point}` — fault classification
- `GET/POST /api/workorders` — CMMS work-orders (create, assign, close)
- `GET /api/maintenance/schedule` — PM calendar / condition-based triggers
- `GET /api/energy` — kWh, kW/ton, baseline vs actual
- `GET /api/kpi` — MTBF, MTTR, availability, downtime-avoided, cost-saved
- `GET /api/network/topology` — BACnet topology + comm-health
- `GET/POST /api/users`, `/api/roles` — RBAC
- `GET/PUT /api/settings` — thresholds, model config, integration creds

---

## Tab-by-tab plan

### 1. Dashboard `/` — 🟡 partial
Done: stat cards (devices/points/alarms), device donut, top alarms, recent events, points-by-type pie.
➕ Extend:
- Fleet **health-score tiles** (green/amber/red per asset class)
- **Assets-at-risk** widget — ranked by RUL / failure probability
- KPI row: MTBF, availability %, downtime-avoided, **cost-saved** (Siemens headline)
- Open work-orders + maintenance-due count
- Replace mock `LINE_SERIES` → real `fetchHistory`
API: `/api/kpi`, `/api/assets/{id}/health`

### 2. Alarms `/alarms` — 🟡 partial
Done: severity cards, filter tabs, alarm list, badges.
➕ Extend:
- **Predictive alerts** lane (anomaly / "fail in N days") separate from reactive threshold alarms
- **Fault classification** tag per alarm (bearing/imbalance/misalignment/looseness)
- Row actions: acknowledge / assign / **→ create work-order**
- Severity ranked by RUL impact + asset criticality, not raw threshold
API: `/api/assets/{id}/anomalies`, `/api/faults/{point}`, `POST /api/workorders`

### 3. Event Log `/events` — 🟡 partial
Done: typed events, search, filter, pagination.
➕ Extend:
- Maintenance audit trail (ack'd by, WO created, repair closed)
- Date-range filter + **export CSV/PDF**

### 4. Devices `/devices` — 🟡 partial
Done: device table, status donut, type pie, online%.
➕ Extend:
- **Health column** per device (score + RUL + trend arrow)
- Asset metadata: make/model, install date, run-hours, criticality, floor/location
- BACnet device → physical asset mapping (this device = which AHU/pump)
API: `/api/assets`, `/api/assets/{id}/health`

### 5. Object Explorer `/objects` — ❌ stub → build
- BACnet object tree: device → objects → properties
- Live present-value, writable-point control (`PUT /api/devices/{id}/points`)
- Point → asset tagging
API: `/api/devices/{id}`, `/api/simulation/snapshot`

### 6. Live Points `/livepoints` — ❌ stub → build
- Real-time present-value grid (`/api/simulation/snapshot`, poll/SSE)
- Per-point sparkline + threshold color
- **Vibration/current waveform** view (high-rate signal for rotating assets)
API: `/api/simulation/snapshot`, `/api/history/{point}`

### 7. Trends `/trends` — 🟡 partial (strongest tab)
Done: history + **forecast p10/p50/p90** band, resolution picker, device→point picker.
➕ Extend:
- **Anomaly overlay** — shade where actual deviates from learned-normal
- Multi-point overlay / correlation (vibration vs temp vs load)
- Baseline / golden-run reference line
- **FFT / vibration spectrum** view (rotating assets)
API: `/api/assets/{id}/anomalies`, `/api/forecast/{point}`

### 8. Schedules `/schedules` — 🟡 partial (BIGGEST gap: it's sim, not CMMS)
Done: scenario start/stop/status (BACnet simulation control).
➕ Extend (split concern):
- Keep scenario sim where it is
- Add **Maintenance workflow / CMMS**: work-order list, PM calendar, technician assign, condition-based trigger → auto-WO (Siemens → SAP PM pattern)
API: `/api/workorders`, `/api/maintenance/schedule`

### 9. Energy `/energy` — ❌ stub → build
- kWh trend, **kW/ton** chiller efficiency, cost
- **Energy-anomaly** (rising consumption = early fault signal)
- Baseline vs actual, per-asset breakdown
API: `/api/energy`

### 10. Performance `/performance` — ❌ stub → build (**PdM home — highest value**)
- Per-asset **health-score** card
- **RUL gauge** + confidence
- Anomaly history timeline
- Fault-classification breakdown
- MTBF / MTTR, efficiency-degradation curve
API: `/api/assets/{id}/health`, `/api/assets/{id}/anomalies`, `/api/kpi`

### 11. Reports `/reports` — ❌ stub → build
- Asset-health summary export (PDF/CSV)
- **Downtime-avoided / cost-saved** report (Siemens KPI)
- PM-completion / compliance
- Scheduled email
API: `/api/kpi`, `/api/assets`

### 12. Network `/network` — ❌ stub → build
- BACnet topology graph
- Device online/offline health
- **Comm-loss alerts** (dead sensor = blind PdM)
API: `/api/network/topology`, `/api/devices`

### 13. Users & Roles `/users` — ❌ stub → build
- RBAC: admin / technician / viewer
- Per-asset assignment
- **Fix hardcoded `admin:admin123`** → real auth (security gap)
API: `/api/users`, `/api/roles`

### 14. Settings `/settings` — ❌ stub → build
- Alert thresholds + **anomaly-model config** + RUL params
- CMMS / SAP integration creds
- Notification routing (email/SMS/Teams)
API: `/api/settings`

---

## Build order (priority)

| # | Item | Tab | Why |
|---|------|-----|-----|
| 1 | Health-score + RUL + anomaly | Performance | PdM brain; forecast backend already exists |
| 2 | Work-order / CMMS workflow | Schedules | Siemens core loop; no maintenance action today |
| 3 | Asset model (criticality, run-hours, RUL col) | Devices | foundation for all PdM |
| 4 | Predictive alerts + fault classification | Alarms | actionable failure prediction |
| 5 | Anomaly overlay + vibration spectrum | Trends, Live Points | detection visualization |
| 6 | Energy anomaly | Energy | early fault signal + cost |
| 7 | Fleet health KPIs | Dashboard | exec rollup |
| 8 | Reports, Network, Users, Settings | — | ops + governance |

**Dependency:** items 1–6 need new backend endpoints (`/api/assets/*`, `/api/workorders`, `/api/kpi`, `/api/faults`). Frontend can stub with mock first, swap to live.

## Shared work (cross-tab)
- Reusable components: `HealthBadge`, `RULGauge`, `AnomalyChart`, `WorkOrderModal`, `AssetTable`
- Asset-context store (selected asset across tabs)
- Real auth replacing Basic `admin:admin123`
- SSE/websocket for live present-values (replace polling)

---

Sources: [Siemens Sachsenmilch PdM](https://www.siemens.com/en-us/company/insights/sachsenmilch-dairy-predictive-maintenance/), [I-care vibration analysis](https://www.icareweb.com/knowledge/predictive-maintenance/what-is-vibration-analysis-predictive-maintenance/), [Neural Concept PdM ML](https://www.neuralconcept.com/post/how-ai-is-used-in-predictive-maintenance)
