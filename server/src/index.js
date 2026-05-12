const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server: SocketIOServer } = require('socket.io');
const pino = require('pino');
const pinoHttp = require('pino-http');
const db = require('./db');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // In Railway logs, plain JSON is most useful; in local dev, we still get
  // structured output that's easy to grep.
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});

const pkg = require('../package.json');

const PORT = process.env.PORT || 3001;
const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: true, credentials: true },
  // Long-poll fallback is fine; Railway supports websockets too.
  transports: ['websocket', 'polling'],
  // Reject unauthenticated handshakes at the HTTP layer (not just at connect).
  allowRequest: (req, cb) => {
    if (!AUTH_PASS) return cb(null, true);
    if (checkBasicAuth(req.headers.authorization)) return cb(null, true);
    cb('unauthorized', false);
  },
});

// Broadcast a realtime event to every connected client.
// `senderId` (X-Client-Id header) lets the originating tab ignore its own echo,
// since it already applied the mutation optimistically.
function broadcast(event, payload, senderId) {
  io.emit(event, { ...payload, _sender: senderId || null });
}

// Read the originating tab's client id from the request (set by the SPA).
function senderOf(req) {
  return req.headers['x-client-id'] || null;
}

io.on('connection', (socket) => {
  // No-op: clients are read-only listeners over the socket; all writes still
  // go through REST endpoints, which then broadcast to everyone.
  socket.emit('hello', { ok: true });
});

// Trust Railway / proxy headers so rate-limit sees real client IP
app.set('trust proxy', 1);
// We set our own collection-level ETags; disable Express's body-hash ETag.
app.set('etag', false);

// ---------- Shared Basic Auth (BASIC_AUTH_PASS) ----------
// When BASIC_AUTH_PASS is set, every /api request and the Socket.io handshake
// must present `Authorization: Basic base64(user:pass)`. user is any value;
// only the password is checked (single shared secret for the 4 internal PCs).
// When the env var is unset (local dev), auth is bypassed.
const AUTH_PASS = process.env.BASIC_AUTH_PASS || '';
const AUTH_REALM = 'Kanban interne';
function checkBasicAuth(headerValue) {
  if (!AUTH_PASS) return true; // disabled
  if (!headerValue || !headerValue.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(headerValue.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx === -1) return false;
    const supplied = decoded.slice(idx + 1);
    // Constant-time comparison to avoid timing leaks.
    const a = Buffer.from(supplied);
    const b = Buffer.from(AUTH_PASS);
    if (a.length !== b.length) return false;
    return require('crypto').timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
function basicAuthMiddleware(req, res, next) {
  if (!AUTH_PASS) return next();
  // Healthcheck is always public so Railway can probe it.
  if (req.path === '/health' || req.path === '/api/health') return next();
  if (checkBasicAuth(req.headers.authorization)) return next();
  res.set('WWW-Authenticate', `Basic realm="${AUTH_REALM}", charset="UTF-8"`);
  return res.status(401).json({ error: 'Authentication required' });
}

// CORS: same-origin in production (the SPA is served by this server), so we
// only need to allow cross-origin during local dev (Vite on :5173 → API on :3010).
// In production, set ALLOWED_ORIGINS="https://your-app.up.railway.app" to lock down.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const corsOptions = {
  origin(origin, cb) {
    // Same-origin requests (no Origin header) are always allowed.
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) {
      // No whitelist configured: allow localhost dev origins only.
      if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return cb(null, true);
      return cb(null, false);
    }
    cb(null, allowedOrigins.includes(origin));
  },
  credentials: true,
};

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      // Tailwind injects inline styles at build time; we keep 'unsafe-inline'
      // for styles only (no inline scripts allowed).
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      // Same-origin XHR/fetch + websocket upgrade for socket.io.
      connectSrc: ["'self'", 'ws:', 'wss:'],
      // No third-party framing/embedding.
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '256kb' }));
app.use(pinoHttp({
  logger,
  // Quiet the healthcheck — it fires every few seconds on Railway and would
  // drown out real signal.
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
}));
app.use(basicAuthMiddleware);

// Apply the same Basic Auth check to the Socket.io handshake.
io.use((socket, next) => {
  if (!AUTH_PASS) return next();
  const header = socket.request.headers.authorization;
  if (checkBasicAuth(header)) return next();
  next(new Error('Authentication required'));
});

const VALID_STATUSES = ['demande', 'devis_en_cours', 'devis_accepte', 'production', 'facturation'];
const VALID_SUBCATS = ['dtf', 'pressage', 'roland_uv', 'trotec', 'autres'];

const ORDER_FIELDS = [
  'client_id', 'title', 'qty', 'product', 'note', 'status',
  'prod_subcat', 'urgent', 'due_date', 'assignees', 'position',
];
const CLIENT_FIELDS = ['name', 'email', 'phone', 'company', 'city', 'notes'];

// Per-field max lengths in characters. Acts as a sanity bound to prevent any
// single field from filling the DB. Validated before insert/update.
const MAX_LEN = {
  // orders
  title: 200,
  product: 200,
  note: 2000,
  assignees: 100,
  due_date: 32,
  // clients
  name: 120,
  email: 200,
  phone: 40,
  company: 200,
  city: 120,
  notes: 4000,
};
function checkStringLengths(body, allowedFields) {
  for (const k of allowedFields) {
    const v = body[k];
    if (typeof v === 'string' && MAX_LEN[k] && v.length > MAX_LEN[k]) {
      return `Field "${k}" exceeds ${MAX_LEN[k]} characters`;
    }
  }
  return null;
}

// ---------- Prepared statements: orders ----------
const stmtSelectAllOrders = db.prepare('SELECT * FROM orders ORDER BY position ASC, id ASC');
const stmtSelectOrderById = db.prepare('SELECT * FROM orders WHERE id = ?');
const stmtInsertOrder = db.prepare(`
  INSERT INTO orders (client_id, title, qty, product, note, status, prod_subcat, urgent, due_date, assignees, position)
  VALUES (@client_id, @title, @qty, @product, @note, @status, @prod_subcat, @urgent, @due_date, @assignees, @position)
`);
const stmtDeleteOrder = db.prepare('DELETE FROM orders WHERE id = ?');
const stmtMaxPositionForStatus = db.prepare(
  'SELECT COALESCE(MAX(position), 0) AS max FROM orders WHERE status = ? AND COALESCE(prod_subcat, \'\') = COALESCE(?, \'\')'
);
const stmtSelectByStatusOrdered = db.prepare(
  'SELECT id, position FROM orders WHERE status = ? AND COALESCE(prod_subcat, \'\') = COALESCE(?, \'\') ORDER BY position ASC, id ASC'
);

// ---------- Prepared statements: clients ----------
const stmtSelectAllClients = db.prepare('SELECT * FROM clients ORDER BY name COLLATE NOCASE ASC');
const stmtSelectClientById = db.prepare('SELECT * FROM clients WHERE id = ?');
const stmtInsertClient = db.prepare(`
  INSERT INTO clients (name, email, phone, company, city, notes)
  VALUES (@name, @email, @phone, @company, @city, @notes)
`);
const stmtDeleteClient = db.prepare('DELETE FROM clients WHERE id = ?');

// ---------- ETag versioning (cheap collection-level cache validators) ----------
// Bumped on every mutation; the ETag is "W/<resource>-<version>".
const versions = { orders: 1, clients: 1 };
function etagFor(resource) {
  return `W/"${resource}-${versions[resource]}"`;
}
function bump(resource) {
  versions[resource]++;
}
function sendWithETag(req, res, resource, payload) {
  const tag = etagFor(resource);
  res.set('ETag', tag);
  res.set('Cache-Control', 'private, max-age=0, must-revalidate');
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && ifNoneMatch === tag) {
    return res.status(304).end();
  }
  res.json(payload);
}

// ---------- Rate limit on /api ----------
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down a bit.' },
}));

// ---------- Helpers ----------
function nextPositionFor(status, prod_subcat) {
  const row = stmtMaxPositionForStatus.get(status, prod_subcat ?? null);
  return (row?.max ?? 0) + 1000;
}

function buildPartialUpdate(table, allowedFields, body) {
  const keys = Object.keys(body).filter((k) => allowedFields.includes(k));
  if (keys.length === 0) return null;
  const sets = keys.map((k) => `${k} = @${k}`);
  if (table === 'orders') sets.push("updated_at = CURRENT_TIMESTAMP");
  const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE id = @id`;
  const params = { id: 0 };
  for (const k of keys) params[k] = body[k];
  return { sql, params };
}

function validateOrderPayload(body, { partial = false } = {}) {
  const lenError = checkStringLengths(body, ORDER_FIELDS);
  if (lenError) return lenError;
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return `Invalid status: ${body.status}`;
  }
  if (body.prod_subcat !== undefined && body.prod_subcat !== null && body.prod_subcat !== '' && !VALID_SUBCATS.includes(body.prod_subcat)) {
    return `Invalid prod_subcat: ${body.prod_subcat}`;
  }
  if (body.qty !== undefined && body.qty !== null && (!Number.isFinite(Number(body.qty)) || Number(body.qty) < 0)) {
    return 'Invalid qty';
  }
  if (body.urgent !== undefined && body.urgent !== null && ![0, 1, true, false].includes(body.urgent)) {
    return 'Invalid urgent (must be 0 or 1)';
  }
  if (!partial && body.title === undefined && body.client_id === undefined) {
    // allow empty creation; title defaults to ''
  }
  return null;
}

function normalizeOrderInput(body) {
  const out = { ...body };
  if (out.urgent === true) out.urgent = 1;
  if (out.urgent === false) out.urgent = 0;
  if (out.qty !== undefined && out.qty !== null) out.qty = Number(out.qty);
  if (out.prod_subcat === '') out.prod_subcat = null;
  return out;
}

// ---------- Health ----------
const startedAt = Date.now();
const stmtHealthPing = db.prepare('SELECT 1 AS ok');
app.get('/api/health', (_req, res) => {
  let dbOk = false;
  try {
    dbOk = stmtHealthPing.get()?.ok === 1;
  } catch (err) {
    logger.error({ err }, 'health: db ping failed');
  }
  const body = {
    ok: dbOk,
    version: pkg.version,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    db: dbOk,
  };
  res.status(dbOk ? 200 : 503).json(body);
});

// ---------- Orders ----------
app.get('/api/orders', (req, res) => {
  try {
    sendWithETag(req, res, 'orders', stmtSelectAllOrders.all());
  } catch (err) {
    logger.error({ err }, "api error");
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.post('/api/orders', (req, res) => {
  try {
    const body = normalizeOrderInput(req.body || {});
    const validationError = validateOrderPayload(body);
    if (validationError) return res.status(400).json({ error: validationError });

    const status = body.status || 'demande';
    const prod_subcat = body.prod_subcat ?? null;
    const position = body.position !== undefined && body.position !== null
      ? Number(body.position)
      : nextPositionFor(status, prod_subcat);

    const payload = {
      client_id: body.client_id ?? null,
      title: body.title ?? '',
      qty: body.qty ?? 0,
      product: body.product ?? '',
      note: body.note ?? '',
      status,
      prod_subcat,
      urgent: body.urgent ?? 0,
      due_date: body.due_date ?? null,
      assignees: body.assignees ?? '',
      position,
    };

    const info = stmtInsertOrder.run(payload);
    const order = stmtSelectOrderById.get(info.lastInsertRowid);
    bump('orders');
    broadcast('order:created', { order }, senderOf(req));
    res.status(201).json(order);
  } catch (err) {
    logger.error({ err }, "api error");
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.patch('/api/orders/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = stmtSelectOrderById.get(id);
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    const body = normalizeOrderInput(req.body || {});
    const validationError = validateOrderPayload(body, { partial: true });
    if (validationError) return res.status(400).json({ error: validationError });

    const update = buildPartialUpdate('orders', ORDER_FIELDS, body);
    if (!update) return res.json(existing);

    update.params.id = id;
    db.prepare(update.sql).run(update.params);
    bump('orders');
    const order = stmtSelectOrderById.get(id);
    broadcast('order:updated', { order }, senderOf(req));
    res.json(order);
  } catch (err) {
    logger.error({ err }, "api error");
    res.status(500).json({ error: 'Failed to update order' });
  }
});

app.delete('/api/orders/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const info = stmtDeleteOrder.run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Order not found' });
    bump('orders');
    broadcast('order:deleted', { id }, senderOf(req));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "api error");
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// POST /api/orders/:id/move
// body { status, prod_subcat?, position? } — position is optional;
// you can pass { before_id, after_id } to compute a midpoint between neighbours.
const stmtUpdateOrderMove = db.prepare(`
  UPDATE orders
  SET status = @status, prod_subcat = @prod_subcat, position = @position, updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
`);

// Wrap the read-then-write move in a single transaction so concurrent moves
// can't see partial state (no `database is locked` / lost updates with 4
// clients moving cards simultaneously).
const moveOrderTxn = db.transaction((id, body) => {
  const existing = stmtSelectOrderById.get(id);
  if (!existing) return { error: 'Order not found', status: 404 };

  const status = body.status ?? existing.status;
  if (!VALID_STATUSES.includes(status)) {
    return { error: `Invalid status: ${status}`, status: 400 };
  }
  let prod_subcat = body.prod_subcat !== undefined ? body.prod_subcat : existing.prod_subcat;
  if (prod_subcat === '') prod_subcat = null;
  if (prod_subcat && !VALID_SUBCATS.includes(prod_subcat)) {
    return { error: `Invalid prod_subcat: ${prod_subcat}`, status: 400 };
  }
  if (status !== 'production') prod_subcat = null;

  let position;
  if (typeof body.position === 'number' && Number.isFinite(body.position)) {
    position = body.position;
  } else if (body.before_id || body.after_id) {
    const before = body.before_id ? stmtSelectOrderById.get(Number(body.before_id)) : null;
    const after = body.after_id ? stmtSelectOrderById.get(Number(body.after_id)) : null;
    if (before && after) position = (before.position + after.position) / 2;
    else if (before) position = before.position + 1000;
    else if (after) position = after.position - 1000;
    else position = nextPositionFor(status, prod_subcat);
  } else {
    position = nextPositionFor(status, prod_subcat);
  }

  stmtUpdateOrderMove.run({ id, status, prod_subcat, position });
  return { order: stmtSelectOrderById.get(id) };
});

app.post('/api/orders/:id/move', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const result = moveOrderTxn(id, req.body || {});
    if (result.error) return res.status(result.status).json({ error: result.error });

    bump('orders');
    broadcast('order:moved', { order: result.order }, senderOf(req));
    res.json(result.order);
  } catch (err) {
    logger.error({ err }, "api error");
    res.status(500).json({ error: 'Failed to move order' });
  }
});

// ---------- Clients ----------
app.get('/api/clients', (req, res) => {
  try {
    sendWithETag(req, res, 'clients', stmtSelectAllClients.all());
  } catch (err) {
    logger.error({ err }, "api error");
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

app.post('/api/clients', (req, res) => {
  try {
    const body = req.body || {};
    const lenError = checkStringLengths(body, CLIENT_FIELDS);
    if (lenError) return res.status(400).json({ error: lenError });
    const info = stmtInsertClient.run({
      name: typeof body.name === 'string' ? body.name : '',
      email: body.email ?? null,
      phone: body.phone ?? null,
      company: body.company ?? null,
      city: body.city ?? null,
      notes: body.notes ?? null,
    });
    bump('clients');
    const client = stmtSelectClientById.get(info.lastInsertRowid);
    broadcast('client:created', { client }, senderOf(req));
    res.status(201).json(client);
  } catch (err) {
    logger.error({ err }, "api error");
    res.status(500).json({ error: 'Failed to create client' });
  }
});

app.patch('/api/clients/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const existing = stmtSelectClientById.get(id);
    if (!existing) return res.status(404).json({ error: 'Client not found' });

    const lenError = checkStringLengths(req.body || {}, CLIENT_FIELDS);
    if (lenError) return res.status(400).json({ error: lenError });
    const update = buildPartialUpdate('clients', CLIENT_FIELDS, req.body || {});
    if (!update) return res.json(existing);

    update.params.id = id;
    db.prepare(update.sql).run(update.params);
    bump('clients');
    const client = stmtSelectClientById.get(id);
    broadcast('client:updated', { client }, senderOf(req));
    res.json(client);
  } catch (err) {
    logger.error({ err }, "api error");
    res.status(500).json({ error: 'Failed to update client' });
  }
});

app.delete('/api/clients/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const info = stmtDeleteClient.run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Client not found' });
    bump('clients');
    // Orders point at clients via ON DELETE SET NULL, so order rows changed too.
    bump('orders');
    const sender = senderOf(req);
    broadcast('client:deleted', { id }, sender);
    broadcast('orders:invalidated', {}, sender);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "api error");
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// ---------- Static client ----------
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      // index.html should always be revalidated so users get the latest bundle hashes.
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

httpServer.listen(PORT, () => {
  logger.info({ port: PORT, auth: !!AUTH_PASS }, 'server listening (http + socket.io)');
});
