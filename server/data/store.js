const fs = require('fs');
const path = require('path');
const catalog = require('../logic/catalog');
const { hashPassword, newId } = require('../logic/security');
const pg = require('./postgres');

const DB_PATH = process.env.NDD_DB_PATH || path.join(__dirname, 'db.json');
const FIXTURE_PATH = path.join(__dirname, '..', '..', 'Starter_Data', 'C26', 'fixture.json');
const DEFAULT_RESTAURANT_ID = 'rest-green-table';
const DEFAULT_CONFIG = { service_radius_km: 3, prep_minutes: 10, handover_minutes: 5, speed_kmph: 18, later_slot_minutes: 40, thin_margin_inr: 10 };

// With DATABASE_URL set the data lives in PostgreSQL. Without it, db.json is used.
let cache = null;

function save(db) {
  if (pg.enabled) {
    cache = structuredClone(db);
    pg.commit(cache);
    return;
  }
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function createDemoUsers() {
  const specs = [
    ['usr_demo_green_owner', 'owner.greentable@lane.local', 'Green Table Owner', 'owner', 'rest-green-table'],
    ['usr_demo_tiffin_owner', 'owner.tiffin@lane.local', 'Little Tiffin Owner', 'owner', 'rest-little-tiffin'],
    ['usr_demo_basil_owner', 'owner.basil@lane.local', 'Basil & Brick Owner', 'owner', 'rest-basil-brick'],
    ['usr_demo_mango_owner', 'owner.mango@lane.local', 'Mango Street Owner', 'owner', 'rest-mango-street'],
  ];
  return specs.map(([id, email, name, role, restaurant_id]) => ({
    id, email, name, role, restaurant_id,
    password_hash: hashPassword('LaneDemo123!'),
    created_at: new Date().toISOString(), active: true,
  }));
}

function baseRestaurants(users = []) {
  const ownersByRestaurant = new Map(users.filter((u) => u.role === 'owner').map((u) => [u.restaurant_id, u.id]));
  return catalog.listRestaurants().map((r) => ({
    ...r,
    owner_user_id: ownersByRestaurant.get(r.id) || null,
    active: true,
    created_at: new Date().toISOString(),
  }));
}

function ensureSchema(db) {
  let changed = false;
  const now = new Date().toISOString();
  const ensureArray = (key) => {
    if (!Array.isArray(db[key])) { db[key] = []; changed = true; }
  };
  ['orders', 'riders', 'alerts', 'decisions', 'premium_memberships', 'users', 'sessions', 'restaurants'].forEach(ensureArray);

  if (!db.users.length) {
    db.users = createDemoUsers();
    changed = true;
  }
  if (!db.restaurants.length) {
    db.restaurants = baseRestaurants(db.users);
    changed = true;
  }

  const restaurantIds = new Set(db.restaurants.map((r) => r.id));
  // Older fixture data is assigned to the first restaurant, preserving all prior demo records.
  db.orders.forEach((o) => {
    if (!o.restaurant_id || !restaurantIds.has(o.restaurant_id)) { o.restaurant_id = DEFAULT_RESTAURANT_ID; changed = true; }
  });
  db.riders.forEach((r) => {
    if (!r.restaurant_id || !restaurantIds.has(r.restaurant_id)) { r.restaurant_id = DEFAULT_RESTAURANT_ID; changed = true; }
  });
  const orderTenant = new Map(db.orders.map((o) => [o.id, o.restaurant_id]));
  db.alerts.forEach((a) => {
    if (!a.restaurant_id) { a.restaurant_id = orderTenant.get(a.order_id) || DEFAULT_RESTAURANT_ID; changed = true; }
  });
  db.decisions.forEach((d) => {
    if (!d.restaurant_id) { d.restaurant_id = orderTenant.get(d.order_id) || DEFAULT_RESTAURANT_ID; changed = true; }
  });
  db.users.forEach((u) => {
    if (u.active === undefined) { u.active = true; changed = true; }
  });

  if (!db.restaurant_configs || typeof db.restaurant_configs !== 'object') {
    db.restaurant_configs = {};
    changed = true;
  }
  for (const restaurant of db.restaurants) {
    if (!db.restaurant_configs[restaurant.id]) {
      db.restaurant_configs[restaurant.id] = { ...DEFAULT_CONFIG, ...(restaurant.id === DEFAULT_RESTAURANT_ID ? db.config || {} : {}) };
      changed = true;
    }
  }
  if (!db.config || typeof db.config !== 'object') { db.config = { ...DEFAULT_CONFIG }; changed = true; }
  return changed;
}

function buildSeed() {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
  const now = new Date().toISOString();
  const users = createDemoUsers();
  const db = {
    orders: fixture.records.orders.map((o) => ({ ...o, status: 'Pending', rider_id: null, restaurant_id: DEFAULT_RESTAURANT_ID, created_at: now, updated_at: now })),
    riders: fixture.records.riders.map((r) => ({ ...r, restaurant_id: DEFAULT_RESTAURANT_ID })),
    alerts: [], decisions: [], premium_memberships: [], sessions: [], users,
    restaurants: baseRestaurants(users),
    config: { ...DEFAULT_CONFIG, service_radius_km: 3 },
    restaurant_configs: {},
  };
  db.restaurants.forEach((r) => { db.restaurant_configs[r.id] = { ...DEFAULT_CONFIG }; });
  db.restaurant_configs[DEFAULT_RESTAURANT_ID] = { ...DEFAULT_CONFIG, ...db.config };
  ensureSchema(db);
  return db;
}

function seed() {
  const db = buildSeed();
  save(db);
  return db;
}

// Call once before the server starts accepting requests.
async function init() {
  if (!pg.enabled) return 'json';
  cache = await pg.init({ buildSeed, ensureSchema });
  return 'postgres';
}

const flush = () => (pg.enabled ? pg.flush() : Promise.resolve());
function load() {
  if (pg.enabled) {
    if (!cache) throw new Error('Database is not ready yet.');
    return structuredClone(cache);
  }
  if (!fs.existsSync(DB_PATH)) return seed();
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  if (ensureSchema(db)) save(db);
  return db;
}

function viewForRestaurant(db, restaurantId) {
  const id = restaurantId || DEFAULT_RESTAURANT_ID;
  const view = {
    ...db,
    orders: db.orders.filter((o) => o.restaurant_id === id),
    riders: db.riders.filter((r) => r.restaurant_id === id),
    alerts: db.alerts.filter((a) => a.restaurant_id === id),
    decisions: db.decisions.filter((d) => d.restaurant_id === id),
    config: { ...(db.restaurant_configs?.[id] || (id === DEFAULT_RESTAURANT_ID ? db.config : DEFAULT_CONFIG)) },
    _allOrderIds: db.orders.map((o) => o.id),
    _restaurantId: id,
  };
  return view;
}

function loadFor(req) {
  if (!req || !req.restaurantId || req.role === 'customer') return load();
  return viewForRestaurant(load(), req.restaurantId);
}

function mergeTenant(full, view, restaurantId) {
  const id = restaurantId;
  ['orders', 'riders', 'alerts', 'decisions'].forEach((key) => {
    const next = view[key] || [];
    full[key] = (full[key] || []).filter((item) => item.restaurant_id !== id).concat(next);
  });
  full.restaurant_configs = full.restaurant_configs || {};
  full.restaurant_configs[id] = { ...view.config };
  if (id === DEFAULT_RESTAURANT_ID) full.config = { ...view.config };
  return full;
}

function createRestaurantForOwner(db, owner, input) {
  const id = newId('rest');
  const name = String(input.name || '').trim();
  const cuisine = String(input.cuisine || 'Neighbourhood kitchen').trim();
  if (name.length < 2 || name.length > 80) throw new Error('Restaurant name must be between 2 and 80 characters.');
  const template = catalog.RESTAURANTS[0];
  const restaurant = {
    id, slug: id, name, cuisine, tagline: String(input.tagline || 'Good food, made nearby.').trim(),
    eta: '25–40 min', rating: 'New', distance_km: 2, emoji: String(input.emoji || '🍽️'), accent: 'sage',
    active: true, owner_user_id: owner.id, created_at: new Date().toISOString(),
    menu: template.menu.map((item, index) => ({ ...item, id: `${id}-item-${index + 1}` })),
  };
  db.restaurants.push(restaurant);
  db.restaurant_configs = db.restaurant_configs || {};
  db.restaurant_configs[id] = { ...DEFAULT_CONFIG };
  owner.restaurant_id = id;
  return restaurant;
}

module.exports = { init, flush, load, save, seed, loadFor, viewForRestaurant, mergeTenant, createRestaurantForOwner, DEFAULT_RESTAURANT_ID, DEFAULT_CONFIG };
