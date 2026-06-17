// Runtime auth — credentials entered at login, never hardcoded in the bundle.
// Backend uses HTTP Basic; we hold the base64 token in sessionStorage
// (cleared when the tab closes) and build the Authorization header from it.

const STORAGE_KEY = "bacnet_auth";

let token = sessionStorage.getItem(STORAGE_KEY) || null;

export function setCredentials(username, password) {
  token = btoa(`${username}:${password}`);
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function clearAuth() {
  token = null;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function isAuthed() {
  return !!token;
}

// Authorization header value, or null when logged out.
export function getAuthHeader() {
  return token ? `Basic ${token}` : null;
}

// Logged-in username decoded from the Basic token (empty if none).
export function getUsername() {
  if (!token) return '';
  try { return atob(token).split(':')[0]; } catch { return ''; }
}
