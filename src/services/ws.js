// WebSocket client service providing a Pub/Sub singleton pattern for the BACnet frontend.
// Auto-reconnects with exponential backoff on connection close or error.

import { getAuthHeader } from "./auth";

let socket = null;
let reconnectTimer = null;
let currentBackoff = 1000; // Start at 1s
const MIN_BACKOFF = 1000;
const MAX_BACKOFF = 30000; // Cap at 30s
let isManuallyClosed = false;

// Subscriptions dictionary mapping message types to Sets of callback functions
const listeners = {};

/**
 * Resolves the absolute WebSocket URL from relative /api/ws.
 * Infers appropriate protocol (ws or wss) and embeds basic auth credentials if present.
 */
function getWsUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  let wsUrl = `${protocol}//`;

  const authHeader = getAuthHeader();
  if (authHeader && authHeader.startsWith("Basic ")) {
    const base64Token = authHeader.substring(6);
    try {
      const credentials = atob(base64Token);
      wsUrl += `${credentials}@`;
    } catch (err) {
      console.error("[WS] Failed to decode Basic Auth token for WebSocket URL:", err);
    }
  }

  wsUrl += `${host}/api/ws`;
  return wsUrl;
}

/**
 * Initiates the WebSocket connection. Idempotent.
 */
export function connect() {
  isManuallyClosed = false;

  if (socket) {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      return;
    }
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const wsUrl = getWsUrl();
  console.log(`[WS] Connecting to ${wsUrl}...`);

  try {
    socket = new WebSocket(wsUrl);
  } catch (err) {
    console.error("[WS] WebSocket connection initialization failed:", err);
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    console.log("[WS] Connection established.");
    currentBackoff = MIN_BACKOFF; // Reset backoff on successful connection
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const type = data.type;

      if (type && listeners[type]) {
        listeners[type].forEach((cb) => {
          try {
            cb(data);
          } catch (cbErr) {
            console.error(`[WS] Error in subscriber callback for type "${type}":`, cbErr);
          }
        });
      }
    } catch (parseErr) {
      console.error("[WS] Failed to parse incoming WebSocket message:", parseErr);
    }
  };

  socket.onclose = (event) => {
    console.log(`[WS] Connection closed. Code: ${event.code}, Reason: ${event.reason || "None"}`);
    socket = null;
    if (!isManuallyClosed) {
      scheduleReconnect();
    }
  };

  socket.onerror = (err) => {
    console.error("[WS] WebSocket error:", err);
  };
}

/**
 * Schedules a reconnection attempt using exponential backoff.
 */
function scheduleReconnect() {
  if (isManuallyClosed) return;
  if (reconnectTimer) return;

  console.log(`[WS] Reconnecting in ${currentBackoff}ms...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
    // Exponential backoff capped at 30s
    currentBackoff = Math.min(currentBackoff * 2, MAX_BACKOFF);
  }, currentBackoff);
}

/**
 * Closes the WebSocket connection and prevents future auto-reconnections.
 */
export function close() {
  console.log("[WS] Manually closing connection.");
  isManuallyClosed = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (socket) {
    socket.close();
    socket = null;
  }
}

/**
 * Registers a subscription callback for a specific message type.
 * Returns an unsubscribe function.
 *
 * @param {string} type - Message type to subscribe to (e.g. "anomaly")
 * @param {Function} cb - Callback function called with parsed message data
 * @returns {Function} Unsubscribe function
 */
export function subscribe(type, cb) {
  if (!listeners[type]) {
    listeners[type] = new Set();
  }
  listeners[type].add(cb);

  return () => {
    if (listeners[type]) {
      listeners[type].delete(cb);
      if (listeners[type].size === 0) {
        delete listeners[type];
      }
    }
  };
}

const wsService = {
  connect,
  close,
  subscribe,
};

export default wsService;
