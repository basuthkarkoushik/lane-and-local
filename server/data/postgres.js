// PostgreSQL storage for Lane & Local.
// Keeps one in-memory copy of the data and writes every change to PostgreSQL tables in the
// background (only changed rows). On start-up the tables are read back into memory.
// Switched on by setting the DATABASE_URL environment variable.
const { Pool } = require('pg');

const URL = process.env.DATABASE_URL || '';
const enabled = Boolean(URL);

const int = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)));
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const text = (v) => (v === null || v === undefined ? null : String(v));
const time = (v) => {
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

function arrayTable(name, key, keyOf, cols) {
  return {
    name,
    cols,
    rows(db) {
      const seen = new Map();
      return (db[key] || []).map((rec) => {
        let pk = String(keyOf(rec));
        const n = (seen.get(pk) || 0) + 1;
        seen.set(pk, n);
        if (n > 1) pk += `#${n}`;
        return { pk, rec };
      });
    },
    put(db, recs) {
      db[key] = recs;
    },
  };
}

const TABLES = [
  arrayTable('restaurants', 'restaurants', (r) => r.id, {
    restaurant_id: ['text', (r) => text(r.id)],
    name: ['text', (r) => text(r.name)],
    owner_user_id: ['text', (r) => text(r.owner_user_id)],
    active: ['boolean', (r) => r.active !== false],
  }),
  arrayTable('users', 'users', (u) => u.id, {
    user_id: ['text', (u) => text(u.id)],
    email: ['text', (u) => text(u.email)],
    name: ['text', (u) => text(u.name)],
    role: ['text', (u) => text(u.role)],
    restaurant_id: ['text', (u) => text(u.restaurant_id)],
    active: ['boolean', (u) => u.active !== false],
  }),
  arrayTable('riders', 'riders', (r) => `${r.restaurant_id}|${r.id}`, {
    rider_id: ['text', (r) => text(r.id)],
    restaurant_id: ['text', (r) => text(r.restaurant_id)],
    max_orders: ['integer', (r) => int(r.max_orders)],
    assigned: ['integer', (r) => int(r.assigned)],
  }),
  arrayTable('orders', 'orders', (o) => o.id, {
    order_id: ['text', (o) => text(o.id)],
    restaurant_id: ['text', (o) => text(o.restaurant_id)],
    status: ['text', (o) => text(o.status)],
    rider_id: ['text', (o) => text(o.rider_id)],
    basket_inr: ['numeric', (o) => num(o.basket_inr)],
    distance_km: ['numeric', (o) => num(o.distance_km)],
  }),
  arrayTable('alerts', 'alerts', (a) => `${a.restaurant_id}|${a.id}`, {
    alert_id: ['text', (a) => text(a.id)],
    restaurant_id: ['text', (a) => text(a.restaurant_id)],
    order_id: ['text', (a) => text(a.order_id)],
    alert_type: ['text', (a) => text(a.type)],
    severity: ['text', (a) => text(a.severity)],
    status: ['text', (a) => text(a.status)],
  }),
  arrayTable('decisions', 'decisions', (d) => `${d.restaurant_id}|${d.id}`, {
    decision_id: ['text', (d) => text(d.id)],
    restaurant_id: ['text', (d) => text(d.restaurant_id)],
    order_id: ['text', (d) => text(d.order_id)],
    decision: ['text', (d) => text(d.decision)],
    decided_at: ['timestamptz', (d) => time(d.timestamp)],
  }),
  arrayTable('sessions', 'sessions', (s) => s.id, {
    session_id: ['text', (s) => text(s.id)],
    user_id: ['text', (s) => text(s.user_id)],
    expires_at: ['timestamptz', (s) => time(s.expires_at)],
  }),
  arrayTable('premium_memberships', 'premium_memberships', (m) => m.id, {
    membership_id: ['text', (m) => text(m.id)],
    user_id: ['text', (m) => text(m.user_id)],
    status: ['text', (m) => text(m.status)],
  }),
  {
    name: 'restaurant_configs',
    cols: { restaurant_id: ['text', (rec, pk) => pk] },
    rows: (db) => Object.entries(db.restaurant_configs || {}).map(([pk, rec]) => ({ pk, rec })),
    put(db, recs, pks) {
      db.restaurant_configs = Object.fromEntries(recs.map((rec, i) => [pks[i], rec]));
    },
  },
  {
    name: 'app_settings',
    cols: {},
    rows: (db) => (db.config ? [{ pk: 'config', rec: db.config }] : []),
    put(db, recs) {
      if (recs[0]) db.config = recs[0];
    },
  },
];

const EXTRA_INDEXES = [
  'CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email))',
  'CREATE INDEX IF NOT EXISTS orders_restaurant_idx ON orders (restaurant_id)',
  'CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status)',
  'CREATE INDEX IF NOT EXISTS alerts_restaurant_idx ON alerts (restaurant_id)',
  'CREATE INDEX IF NOT EXISTS decisions_restaurant_idx ON decisions (restaurant_id)',
  'CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)',
];

const colNames = (t) => Object.keys(t.cols);

function createSql(t) {
  const cols = colNames(t).map((c) => `"${c}" ${t.cols[c][0]}`);
  return `CREATE TABLE IF NOT EXISTS "${t.name}" (seq bigserial, pk text PRIMARY KEY${cols.length ? ', ' + cols.join(', ') : ''}, data jsonb NOT NULL)`;
}

function upsertSql(t) {
  const names = ['pk', ...colNames(t), 'data'];
  const marks = names.map((_, i) => `$${i + 1}`);
  const updates = names.slice(1).map((c) => `"${c}" = EXCLUDED."${c}"`);
  return `INSERT INTO "${t.name}" (${names.map((c) => `"${c}"`).join(', ')}) VALUES (${marks.join(', ')}) ON CONFLICT (pk) DO UPDATE SET ${updates.join(', ')}`;
}

// Hosted databases (Neon, Render, Supabase) put ?sslmode=require in the URL. We handle SSL
// ourselves below, so remove those parameters to avoid the two settings fighting.
function cleanUrl(url) {
  try {
    const u = new globalThis.URL(url);
    ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert'].forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return url;
  }
}

function needsSsl(url) {
  if (process.env.PGSSLMODE === 'disable') return false;
  return !/@(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/i.test(url);
}

let pool = null;
let latest = null; // newest snapshot waiting to be written
let persisted = {}; // table -> Map(pk -> JSON text) of what PostgreSQL currently holds
let dirty = false;
let running = null;

async function persistOnce() {
  const snapshot = latest;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const next = {};
    for (const t of TABLES) {
      const prev = persisted[t.name] || new Map();
      const current = new Map();
      for (const { pk, rec } of t.rows(snapshot)) current.set(pk, { rec, json: JSON.stringify(rec) });

      const sql = upsertSql(t);
      for (const [pk, { rec, json }] of current) {
        if (prev.get(pk) === json) continue; // unchanged: skip
        const values = [pk, ...colNames(t).map((c) => t.cols[c][1](rec, pk)), json];
        await client.query(sql, values);
      }
      for (const pk of prev.keys()) {
        if (!current.has(pk)) await client.query(`DELETE FROM "${t.name}" WHERE pk = $1`, [pk]);
      }
      next[t.name] = new Map([...current].map(([pk, v]) => [pk, v.json]));
    }
    await client.query('COMMIT');
    persisted = next;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('PostgreSQL save failed (will retry on the next change):', err.message);
  } finally {
    client.release();
  }
}

function schedule() {
  dirty = true;
  if (running) return;
  running = (async () => {
    while (dirty) {
      dirty = false;
      await persistOnce();
    }
    running = null;
  })();
}

function commit(db) {
  latest = db;
  schedule();
}

async function flush() {
  if (!pool) return;
  if (dirty && !running) schedule();
  while (running) await running;
}

function makePool() {
  return new Pool({
    connectionString: cleanUrl(URL),
    ssl: needsSsl(URL) ? { rejectUnauthorized: false } : false,
    max: 5,
  });
}

// Read-only snapshot of every table (used by view-db.js). Never creates or changes anything.
async function readAll() {
  const p = makePool();
  try {
    const db = {};
    for (const t of TABLES) {
      const { rows } = await p.query(`SELECT pk, data FROM "${t.name}" ORDER BY seq`).catch(() => ({ rows: [] }));
      t.put(db, rows.map((r) => r.data), rows.map((r) => r.pk));
    }
    return db;
  } finally {
    await p.end();
  }
}

async function init({ buildSeed, ensureSchema }) {
  pool = makePool();
  pool.on('error', (err) => console.error('PostgreSQL connection error:', err.message));

  await pool.query('SELECT 1'); // fail fast with a clear message if the URL is wrong
  for (const t of TABLES) await pool.query(createSql(t));
  for (const sql of EXTRA_INDEXES) await pool.query(sql);

  const raw = {};
  persisted = {};
  for (const t of TABLES) {
    const { rows } = await pool.query(`SELECT pk, data FROM "${t.name}" ORDER BY seq`);
    persisted[t.name] = new Map(rows.map((r) => [r.pk, JSON.stringify(r.data)]));
    t.put(raw, rows.map((r) => r.data), rows.map((r) => r.pk));
  }

  const empty = TABLES.every((t) => persisted[t.name].size === 0);
  let db;
  if (empty) {
    db = buildSeed(); // first run: start from the C26 fixture and the demo accounts
  } else {
    db = raw;
    ensureSchema(db);
  }
  latest = db;
  await persistOnce();
  return db;
}

module.exports = { enabled, init, commit, flush, readAll, TABLES };