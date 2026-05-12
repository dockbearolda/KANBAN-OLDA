import { io } from 'socket.io-client';

// Stable per-tab identifier so the server can tell us which broadcast event
// originated from our own mutation (we already applied it optimistically).
function getClientId() {
  try {
    let id = sessionStorage.getItem('kanban:clientId');
    if (!id) {
      id = (crypto.randomUUID?.() || `c-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      sessionStorage.setItem('kanban:clientId', id);
    }
    return id;
  } catch {
    return `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export const CLIENT_ID = getClientId();

// Lazy singleton — created on first import, shared by every hook.
export const socket = io({
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
});

// Convenience: returns true if an event payload was authored by THIS tab,
// so callers can short-circuit and skip re-applying their own mutation.
export function isOwnEcho(payload) {
  return payload && payload._sender && payload._sender === CLIENT_ID;
}
