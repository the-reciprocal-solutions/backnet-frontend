// Work-order + alarm-acknowledgement store.
// Interim: persisted in localStorage. Swap to `/api/workorders` when the
// backend endpoint lands — keep this module's function signatures stable.

const WO_KEY  = "bacnet_workorders";
const ACK_KEY = "bacnet_acked_alarms";

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function write(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ---- Acknowledgements ------------------------------------------------------
export function getAckedIds() {
  return new Set(read(ACK_KEY, []));
}
export function ackAlarm(alarmId) {
  const ids = read(ACK_KEY, []);
  if (!ids.includes(alarmId)) { ids.push(alarmId); write(ACK_KEY, ids); }
}
export function unackAlarm(alarmId) {
  write(ACK_KEY, read(ACK_KEY, []).filter((id) => id !== alarmId));
}

// ---- Work orders -----------------------------------------------------------
export function getWorkOrders() {
  return read(WO_KEY, []);
}

// Create a WO from an alarm. Returns the new work order.
export function createWorkOrder(alarm) {
  const wos = read(WO_KEY, []);
  const wo = {
    id: `WO-${Date.now().toString(36).toUpperCase()}`,
    alarm_id: alarm.id,
    device_id: alarm.device_id,
    point_name: alarm.point_name,
    severity: alarm.severity,
    title: alarm.message || `Alarm on ${alarm.point_name}`,
    status: "open", // open | in_progress | closed
    assignee: "",
    created_at: new Date().toISOString(),
  };
  wos.unshift(wo);
  write(WO_KEY, wos);
  return wo;
}

export function updateWorkOrder(id, patch) {
  const wos = read(WO_KEY, []).map((w) => (w.id === id ? { ...w, ...patch } : w));
  write(WO_KEY, wos);
  return wos;
}

// Map alarm_id → work order, to mark which alarms already have one.
export function getWorkOrderByAlarm() {
  const map = {};
  for (const w of read(WO_KEY, [])) map[w.alarm_id] = w;
  return map;
}
