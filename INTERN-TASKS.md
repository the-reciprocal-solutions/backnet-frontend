
These tasks are self-contained and low-risk. The hard parts (pipeline orchestration,
reasoning layer, anomaly model, event schema) are owned by the lead and already designed.
You build **against a fixed contract** — the enriched-event schema below. Do not change
that schema; if something seems missing, ask the lead.

Two repos:
- **Backend**: `bacnet-simulator/` (Python, FastAPI, hexagonal — ports/adapters)
- **Frontend**: `BACnet-frontend/` (React 18 + Vite + recharts)

---

## The Contract (READ FIRST — do not modify)

Every anomaly the backend detects is published as one JSON message over WebSocket.
Both your backend WS code and your frontend client bind to this exact shape:

```json
{
  "type": "anomaly",
  "device_id": 42,
  "point": "AHU-1.vibration",
  "value": 8.3,
  "unit": "mm/s",
  "severity": "high",
  "anomaly": {
    "score": 0.91,
    "kind": "vibration_spike"
  },
  "reasoning": {
    "component": "bearing",
    "failure_prob": 0.78,
    "eta_hours": 36,
    "explanation": "Vibration trending up 3x baseline over 2h."
  },
  "ts": "2026-06-17T10:30:00Z"
}
```

- `type` — `"anomaly"`, or `"work_order"` (second message type, below).
- `severity` — one of `"low" | "medium" | "high"`.
- `reasoning` — populated by the backend (component, failure_prob 0–1, eta_hours).
  Any inner field may still be `null`. Your UI must handle `reasoning === null`
  and null inner fields gracefully (show anomaly, hide whatever is missing).

A second message type arrives when the backend predicts a **future** failure and
auto-assigns a maintenance work order. Render these as an action/work-order feed:

```json
{
  "type": "work_order",
  "work_order_id": "uuid",
  "device_id": 42,
  "point": "AHU-1/vibration",
  "component": "AHU-1",
  "action": "Inspect AHU-1 bearing/mounts for imbalance or wear",
  "severity": "high",
  "eta_hours": 2.0,
  "failure_prob": 0.8,
  "reason": "Forecast rising to operating limit in ~120 min.",
  "ts": "2026-06-17T10:30:00Z"
}
```

Dispatch on `message.type` in your F1 WS client; `anomaly` → chart overlay,
`work_order` → work-order list.

---

## BACKEND TASKS (bacnet-simulator)

### B1. WebSocket adapter + connection manager
**File (new):** `src/bacnet_lab/adapters/web/websocket.py`

- Implement a `ConnectionManager` class:
  - `connect(ws)` — accept, add to an internal set of clients.
  - `disconnect(ws)` — remove from set.
  - `async broadcast(message: dict)` — send JSON to every connected client; drop and
    remove any client that errors on send (don't let one dead socket kill the loop).
- Add a FastAPI WebSocket route `@router.websocket("/api/ws")` in this file (or wire into
  the existing `adapters/web/router.py`):
  - On connect → `manager.connect`.
  - Loop awaiting client messages (keep-alive / ignore content for now).
  - On `WebSocketDisconnect` → `manager.disconnect`.
- Export a single shared `manager` instance for the lead to call from the pipeline.

**Acceptance:** Connect with a WS test client (e.g. `websocat ws://localhost:8000/api/ws`),
then in a Python REPL call `manager.broadcast({"hello":"world"})` → client receives it.
Two clients both receive. Killing one client does not break the other.

**Do NOT:** call PredictionService / CopilotService here. WS layer only moves bytes.

---

### B2. Modbus protocol adapter
**Files (new):** `src/bacnet_lab/adapters/modbus/` — mirror the structure of
`adapters/bacnet/`. Look at how the BACnet adapter implements the
`ports/device_network.py` port and copy that pattern.

- Use `pymodbus` (async client).
- Implement the same `DeviceNetworkPort` interface the BACnet adapter implements:
  read/write points, list devices.
- **Discovery:** Modbus has no native discovery. Implement `discover()` as a configurable
  scan: given a host + unit-ID range (from config), probe each unit ID, return the ones
  that respond, normalized to the domain device model.
- Read config from `infrastructure/config.py` (add Modbus host/port/unit-range there).

**Acceptance:** Point at a Modbus simulator (e.g. `pymodbus` server example), `discover()`
returns the live unit IDs, read a holding register returns its value through the domain model.

**Do NOT:** invent a new port interface. Implement the existing `DeviceNetworkPort`.

---

### B3. Webhook subscriber (small)
**File:** wire into existing `adapters/webhook/`.

- Add a handler that, given an enriched-anomaly dict (the contract above), POSTs it to a
  configurable webhook URL (from config). Retry once on failure, log on give-up.
- The lead will register your handler on the event bus. You only build the
  "given a dict, POST it" function + config.

**Acceptance:** Point webhook URL at `https://webhook.site/...`, feed a sample dict → it
arrives. Bad URL → logs error, does not crash.

---

## FRONTEND TASKS (BACnet-frontend)

### F1. WebSocket client service
**File (new):** `src/services/ws.js`

- Open `new WebSocket(...)` to `/api/ws` (same-origin; Vite dev proxy handles it — match
  how `src/services/api.js` resolves the base).
- Auto-reconnect with backoff on close/error (start 1s, cap 30s).
- Expose a subscribe API: callers register a callback per `message.type`
  (e.g. `subscribe("anomaly", cb)`). On each WS message, parse JSON and dispatch to the
  matching callbacks.
- Export a singleton (one socket for the whole app), plus `connect()` / `close()`.

**Acceptance:** With backend B1 running, `subscribe("anomaly", console.log)` prints every
broadcast. Kill backend → client retries; restart backend → reconnects, messages resume.

**Reference:** `src/services/api.js` for base-URL convention and error style.

---

### F2. Live anomaly chart with reasoning overlay
**Files:** new component under `src/components/`, used on a page in `src/pages/`.

- A recharts line chart for one point (start with `AHU-1.vibration`).
- Initial data: fetch history via existing `src/services/api.js` (`fetchHistory`).
- Live updates: `subscribe("anomaly", ...)` from F1 — append new points, mark anomaly
  points (colored dot / reference line by `severity`).
- **Reasoning overlay:** when a message has non-null `reasoning`, show a tooltip/badge on
  that point with `component`, `failure_prob` (as %), and `eta_hours`
  ("bearing — 78% — ~36h"). When `reasoning === null`, show the anomaly dot only.

**Acceptance:** Chart loads history, then live anomalies appear in real time with the
reasoning badge. Null-reasoning message → dot shows, no badge, no crash.

**Do NOT:** compute predictions in the frontend. The backend sends them. (Note:
`src/services/predict.js` does client-side prediction today — ignore it for this task.)

---

### F3. Connection-status indicator (small)
**Files:** small component, mount in app shell (`src/App.jsx`).

- Show WS state: connected (green) / reconnecting (amber) / disconnected (red).
- Drive it off F1's socket state (expose an `onStatusChange` hook from `ws.js`).

**Acceptance:** Indicator flips amber→red when backend dies, green on reconnect.

---

## Suggested Order

1. **B1** (WS adapter) + **F1** (WS client) — do together, they prove the pipe.
2. **F2** (live chart) — the visible payoff.
3. **B2** (Modbus) — independent, can run in parallel.
4. **B3** + **F3** — small finishers.

## Ground Rules

- Branch per task: `intern/b1-websocket`, `intern/f1-ws-client`, etc. PR to `main`.
- **Never commit secrets.** Tokens go in env vars / `.claude/settings.local.json` (gitignored).
- **Never commit `node_modules/` or `dist/`** — already gitignored, keep it that way.
- The enriched-event schema is fixed. Build to it; flag gaps to the lead, don't redesign.
- Ask early if a port interface or config shape is unclear — don't guess and rewrite core.

---

# Round 2 — Discovery, scale, webhooks, deeper reasoning

Pipeline + WS + live grid are live. Next batch widens protocol coverage, scales
the device fleet, fires webhooks after reasoning, and deepens the LLM failure
explanations. Same rules as above: build to the contracts, flag gaps to the lead.

## BACKEND

### B4. Per-device protocol tag + discovery endpoint
The frontend Discovery page (F4) must group devices by protocol. The backend
must say which protocol each device speaks.

- Add a `protocol` field to the device model + `DeviceResponse`
  (`"bacnet" | "mqtt" | "knx" | "modbus"`). Default `"bacnet"` for existing rows
  (coalesce NULL → `"bacnet"`, same pattern as the recent 500 fix).
- New `GET /api/discovery` → devices grouped by protocol:
  ```json
  { "bacnet": [ {device_id, name, point_count, status} ], "mqtt": [...], "knx": [...], "modbus": [...] }
  ```
- Where a protocol has native discovery (BACnet Who-Is), surface discovered vs
  configured count. Modbus/MQTT: list configured devices.

**Acceptance:** `GET /api/discovery` returns the 4 protocol buckets; every device
appears under exactly one; counts match `/api/devices`.

**Do NOT:** invent a second device source of truth. Tag the existing devices.

### B5. 100+ devices across protocols
- Generate a fleet of 100+ devices spanning BACnet / MQTT / KNX / Modbus
  (mix of AHU / FCU / sensors / meters). Use the existing YAML device-config
  format under `config/devices/` (or a generator script that emits them).
- Each device tagged with its `protocol` (B4). Each has >=1 dynamic analog point
  so it is anomaly-capable (avoid all-`constant` devices).
- Keep boot time sane — lazy/staggered start if needed.

**Acceptance:** `/api/devices` lists 100+; `/api/discovery` shows a realistic
split across all 4 protocols; injecting an anomaly on a sampled device still
flows through to the live grid.

**Do NOT:** hardcode 100 near-identical clones — vary type, points, ranges.

### B6. Webhook fire AFTER LLM reasoning
- Register a webhook subscriber on the bus for `AnomalyEnriched` **and**
  `WorkOrderAssigned` (emitted only after the reasoning layer runs). POST the
  event's `to_message()` JSON to a configurable webhook URL.
- Reuse the existing `adapters/webhook/` delivery. Config: webhook URL + on/off
  in settings (yaml + env), default off.
- Retry once on failure, log on give-up. Must never block the pipeline.

**Acceptance:** point webhook at `https://webhook.site/...`, inject an anomaly →
the enriched + work-order payloads arrive AFTER reasoning (have `reasoning` /
`failure_prob` populated). Bad URL → logged, pipeline unaffected.

**Do NOT:** fire on raw `AlarmRaised` (pre-reasoning, no explanation yet).

### L1. Deeper failure reasoning (LLM)
- Extend `CopilotService.explain()` so reasoning carries more than a one-line
  narration. Target richer fields the frontend can render: `root_cause`,
  `contributing_factors[]`, `recommended_action`, `confidence`.
- Keep it grounded — only cite measured evidence (forecast quantiles, driver
  deltas, recent events). No invented numbers.
- Extend the `reasoning` block of the `AnomalyEnriched` contract **additively**
  (new optional fields only — do NOT rename/remove existing ones; the grid +
  webhook consumers depend on them).

**Acceptance:** enriched `reasoning` includes the new fields when the LLM is on;
falls back gracefully (nulls) when off. Existing fields unchanged.

**Do NOT:** break the frozen contract — additive fields only.

## FRONTEND

### F4. Discovery page (devices by protocol)
**Files:** new `src/pages/DiscoveryPage.jsx`, route + sidebar entry.

- Fetch `GET /api/discovery`. Render one section/column per protocol
  (BACnet / MQTT / KNX / Modbus) with a device card list: name, device_id,
  point count, status, protocol badge.
- Show per-protocol counts + a total. Search/filter by name.
- Click a device → reuse existing device detail (or link to Devices page).
- Handle empty buckets; render cleanly with 100+ devices.

**Acceptance:** page shows all 4 protocol groups with correct devices/counts;
matches `/api/devices` total; renders cleanly with 100+ devices (B5).

**Do NOT:** duplicate device-fetch logic — extend `src/services/api.js`.

## Suggested Order
1. **B4** (protocol tag + `/api/discovery`) — unblocks F4.
2. **F4** (Discovery page) + **B5** (100+ devices) in parallel.
3. **B6** (post-reasoning webhook) — independent.
4. **L1** (deeper reasoning) — additive, last; coordinate the contract change with the lead.
