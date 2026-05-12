import { CLIENT_ID } from './socket.js';

async function http(url, { method = 'GET', body } = {}) {
  const headers = { 'X-Client-Id': CLIENT_ID };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error || ''; } catch { /* ignore */ }
    throw new Error(`${method} ${url} → ${res.status} ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---- Orders ----
export const getOrders   = ()                 => http('/api/orders');

// ETag-aware fetch used by the background poller.
// Returns { notModified: true } on 304, or { notModified: false, etag, data } on 200.
export async function fetchOrdersWithETag(prevETag) {
  const headers = { 'X-Client-Id': CLIENT_ID };
  if (prevETag) headers['If-None-Match'] = prevETag;
  const res = await fetch('/api/orders', { headers });
  if (res.status === 304) return { notModified: true };
  if (!res.ok) throw new Error(`GET /api/orders → ${res.status}`);
  const etag = res.headers.get('ETag');
  const data = await res.json();
  return { notModified: false, etag, data };
}
export const createOrder = (data = {})        => http('/api/orders', { method: 'POST', body: data });
export const updateOrder = (id, patch)        => http(`/api/orders/${id}`, { method: 'PATCH', body: patch });
export const deleteOrder = (id)               => http(`/api/orders/${id}`, { method: 'DELETE' });
export const moveOrder   = (id, payload)      => http(`/api/orders/${id}/move`, { method: 'POST', body: payload });

// ---- Clients ----
export const getClients   = ()                => http('/api/clients');
export const createClient = (data)            => http('/api/clients', { method: 'POST', body: data });
export const updateClient = (id, patch)       => http(`/api/clients/${id}`, { method: 'PATCH', body: patch });
export const deleteClient = (id)              => http(`/api/clients/${id}`, { method: 'DELETE' });
