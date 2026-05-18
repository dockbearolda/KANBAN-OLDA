const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = process.env.DB_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dataDir, 'data.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    qty INTEGER DEFAULT 0,
    product TEXT DEFAULT '',
    note TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'demande',
    prod_subcat TEXT,
    urgent INTEGER DEFAULT 0,
    due_date TEXT,
    assignees TEXT DEFAULT '',
    position REAL DEFAULT 0,
    contact_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_prod_subcat ON orders(prod_subcat);

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    body TEXT NOT NULL DEFAULT '',
    author TEXT DEFAULT '',
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT
  );
`);

// Idempotent migration: add clients.city if missing
const clientCols = db.prepare("PRAGMA table_info(clients)").all().map((c) => c.name);
if (!clientCols.includes('city')) {
  db.exec("ALTER TABLE clients ADD COLUMN city TEXT");
}

// Idempotent migration: add orders.contact_name / orders.phone if missing
const orderCols = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
if (!orderCols.includes('contact_name')) {
  db.exec("ALTER TABLE orders ADD COLUMN contact_name TEXT DEFAULT ''");
}
if (!orderCols.includes('phone')) {
  db.exec("ALTER TABLE orders ADD COLUMN phone TEXT DEFAULT ''");
}

module.exports = db;
