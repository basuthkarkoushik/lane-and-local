const express = require('express');
const crypto = require('crypto');
const store = require('../data/store');
const { AppError } = require('../logic/validation');
const { hashPassword, verifyPassword, newToken, tokenHash, newId } = require('../logic/security');

const router = express.Router();
const SESSION_DAYS = 14;

const publicUser = (user, db) => {
  const restaurant = user.restaurant_id ? db.restaurants.find((r) => r.id === user.restaurant_id) : null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    restaurant_id: user.restaurant_id || null,
    restaurant_name: restaurant?.name || null,
    ...(user.role === 'rider' ? { rider_id: user.rider_id || null } : {}),
  };
};

function cleanAccount(input, { needsRestaurant = false } = {}) {
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  const restaurantName = String(input.restaurant_name || '').trim();
  if (name.length < 2 || name.length > 40) throw new AppError(400, 'Enter a name between 2 and 40 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) throw new AppError(400, 'Enter a valid email address.');
  if (password.length < 8 || password.length > 128) throw new AppError(400, 'Password must be at least 8 characters long.');
  if (needsRestaurant && (restaurantName.length < 2 || restaurantName.length > 80)) throw new AppError(400, 'Enter your restaurant name.');
  return { name, email, password, restaurantName };
}

function issueSession(db, user) {
  const token = newToken();
  const now = Date.now();
  db.sessions = db.sessions.filter((s) => new Date(s.expires_at).getTime() > now);
  db.sessions.push({
    id: newId('ses'), user_id: user.id, token_hash: tokenHash(token),
    created_at: new Date(now).toISOString(), expires_at: new Date(now + SESSION_DAYS * 86400000).toISOString(),
  });
  return { access_token: token, token_type: 'Bearer', expires_at: db.sessions[db.sessions.length - 1].expires_at, user: publicUser(user, db) };
}

// Customers and restaurant owners can register. Dispatchers are invited by an owner.
router.post('/register', (req, res, next) => {
  try {
    const role = String(req.body.role || 'customer').toLowerCase();
    if (!['customer', 'owner'].includes(role)) throw new AppError(400, 'Choose customer or restaurant owner. Dispatchers must be invited by a restaurant owner.');
    const fields = cleanAccount(req.body, { needsRestaurant: role === 'owner' });
    const db = store.load();
    if (db.users.some((u) => u.email.toLowerCase() === fields.email)) throw new AppError(409, 'An account with this email already exists. Sign in instead.');

    const user = {
      id: newId('usr'), name: fields.name, email: fields.email, role,
      password_hash: hashPassword(fields.password), active: true,
      restaurant_id: null, created_at: new Date().toISOString(),
    };
    db.users.push(user);
    if (role === 'owner') {
      const restaurant = store.createRestaurantForOwner(db, user, { name: fields.restaurantName, cuisine: req.body.cuisine, tagline: req.body.tagline });
      restaurant.owner_user_id = user.id;
    }
    const session = issueSession(db, user);
    store.save(db);
    res.status(201).json(session);
  } catch (err) { next(err); }
});

router.post('/login', (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) throw new AppError(400, 'Enter your email and password.');
    const db = store.load();
    const user = db.users.find((u) => u.email.toLowerCase() === email && u.active !== false);
    if (!user || !verifyPassword(password, user.password_hash)) throw new AppError(401, 'Email or password is incorrect.');
    const session = issueSession(db, user);
    store.save(db);
    res.json(session);
  } catch (err) { next(err); }
});

router.get('/me', (req, res) => {
  const db = store.load();
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) throw new AppError(401, 'Account no longer exists.');
  res.json({ user: publicUser(user, db) });
});

router.post('/logout', (req, res) => {
  const db = store.load();
  db.sessions = db.sessions.filter((s) => s.id !== req.sessionId);
  store.save(db);
  res.json({ ok: true });
});

router.get('/restaurant', (req, res) => {
  const db = store.load();
  const restaurant = db.restaurants.find((r) => r.id === req.restaurantId);
  if (!restaurant) throw new AppError(404, 'Restaurant not found.');
  res.json({ ...restaurant, owner_user_id: req.role === 'owner' ? restaurant.owner_user_id : undefined });
});

router.put('/restaurant', (req, res) => {
  if (req.role !== 'owner') throw new AppError(403, 'Only the restaurant owner can edit restaurant details.');
  const name = String(req.body.name || '').trim();
  const cuisine = String(req.body.cuisine || '').trim();
  if (name.length < 2 || name.length > 80) throw new AppError(400, 'Restaurant name must be between 2 and 80 characters.');
  const db = store.load();
  const restaurant = db.restaurants.find((r) => r.id === req.restaurantId && r.owner_user_id === req.userId);
  if (!restaurant) throw new AppError(404, 'Restaurant not found for this owner.');
  restaurant.name = name;
  if (cuisine) restaurant.cuisine = cuisine.slice(0, 80);
  restaurant.updated_at = new Date().toISOString();
  store.save(db);
  res.json({ ...restaurant, owner_user_id: undefined });
});

router.get('/dispatchers', (req, res) => {
  const db = store.load();
  const restaurant = db.restaurants.find((r) => r.id === req.restaurantId && r.owner_user_id === req.userId);
  if (!restaurant) throw new AppError(403, 'You can only manage dispatchers for your own restaurant.');
  const dispatchers = db.users.filter((u) => u.role === 'dispatcher' && u.restaurant_id === restaurant.id).map((u) => ({
    id: u.id, name: u.name, email: u.email, active: u.active !== false, created_at: u.created_at,
  }));
  res.json({ restaurant: restaurant.name, dispatchers });
});

router.post('/dispatchers', (req, res) => {
  if (req.role !== 'owner') throw new AppError(403, 'Only the owner can add dispatchers.');
  const fields = cleanAccount(req.body);
  const db = store.load();
  const restaurant = db.restaurants.find((r) => r.id === req.restaurantId && r.owner_user_id === req.userId);
  if (!restaurant) throw new AppError(403, 'You can only add dispatchers to your own restaurant.');
  if (db.users.some((u) => u.email.toLowerCase() === fields.email)) throw new AppError(409, 'An account with this email already exists.');
  const user = {
    id: newId('usr'), name: fields.name, email: fields.email, role: 'dispatcher',
    password_hash: hashPassword(fields.password), active: true,
    restaurant_id: restaurant.id, invited_by: req.userId, created_at: new Date().toISOString(),
  };
  db.users.push(user);
  store.save(db);
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, restaurant_id: user.restaurant_id, active: user.active });
});

router.delete('/dispatchers/:id', (req, res) => {
  if (req.role !== 'owner') throw new AppError(403, 'Only the owner can remove dispatchers.');
  const db = store.load();
  const user = db.users.find((u) => u.id === req.params.id && u.role === 'dispatcher' && u.restaurant_id === req.restaurantId);
  if (!user) throw new AppError(404, 'Dispatcher not found in your restaurant.');
  user.active = false;
  user.disabled_at = new Date().toISOString();
  db.sessions = db.sessions.filter((s) => s.user_id !== user.id);
  store.save(db);
  res.json({ ok: true });
});

// Rider accounts are created by the restaurant owner and linked to an existing
// capacity profile, or to a new profile created in the same operation.
router.get('/riders', (req, res) => {
  if (req.role !== 'owner') throw new AppError(403, 'Only the owner can manage rider accounts.');
  const db = store.load();
  const restaurant = db.restaurants.find((r) => r.id === req.restaurantId && r.owner_user_id === req.userId);
  if (!restaurant) throw new AppError(403, 'You can only manage riders for your own restaurant.');

  const ACTIVE_ORDERS = ['Assigned', 'Preparing', 'Out for Delivery'];
  const riders = db.riders.filter((r) => r.restaurant_id === restaurant.id).map((r) => {
    const user = db.users.find((u) => u.role === 'rider' && u.rider_id === r.id && u.restaurant_id === restaurant.id);
    const linkedOrders = db.orders.filter((o) => o.restaurant_id === restaurant.id && o.rider_id === r.id && ACTIVE_ORDERS.includes(o.status));
    return {
      id: r.id,
      max_orders: r.max_orders,
      assigned: r.assigned,
      active_order_count: linkedOrders.length,
      account: user ? { id: user.id, name: user.name, email: user.email, active: user.active !== false, created_at: user.created_at } : null,
    };
  });
  res.json({ restaurant: restaurant.name, riders });
});

router.post('/riders', (req, res) => {
  if (req.role !== 'owner') throw new AppError(403, 'Only the owner can register riders.');
  const fields = cleanAccount(req.body);
  const requestedRiderId = String(req.body.rider_id || '').trim();
  const maxOrders = req.body.max_orders === undefined || req.body.max_orders === '' ? 3 : Number(req.body.max_orders);
  if (!Number.isInteger(maxOrders) || maxOrders < 1 || maxOrders > 50) {
    throw new AppError(400, 'Maximum orders must be a whole number between 1 and 50.');
  }

  const db = store.load();
  const restaurant = db.restaurants.find((r) => r.id === req.restaurantId && r.owner_user_id === req.userId);
  if (!restaurant) throw new AppError(403, 'You can only register riders for your own restaurant.');
  if (db.users.some((u) => u.email.toLowerCase() === fields.email)) {
    throw new AppError(409, 'An account with this email already exists.');
  }

  let rider;
  if (requestedRiderId) {
    rider = db.riders.find((r) => r.id === requestedRiderId && r.restaurant_id === restaurant.id);
    if (!rider) throw new AppError(404, 'The selected rider profile was not found in your restaurant.');
    const alreadyLinked = db.users.some((u) => u.role === 'rider' && u.rider_id === rider.id && u.restaurant_id === restaurant.id);
    if (alreadyLinked) throw new AppError(409, `Rider ${rider.id} already has a sign-in account.`);

    // Old fixture profiles contain synthetic, unlinked assignment counts.
    // When a real account is attached, reconcile capacity to actual open orders.
    const activeStatuses = ['Assigned', 'Preparing', 'Out for Delivery'];
    rider.assigned = db.orders.filter((o) => o.restaurant_id === restaurant.id && o.rider_id === rider.id && activeStatuses.includes(o.status)).length;
    if (maxOrders < rider.assigned) throw new AppError(409, `This rider currently has ${rider.assigned} active order(s); capacity cannot be lower.`);
    rider.max_orders = maxOrders;
  } else {
    const used = db.riders.filter((r) => r.restaurant_id === restaurant.id).map((r) => /^R(\d+)$/i.exec(r.id)).filter(Boolean).map((m) => Number(m[1]));
    let next = Math.max(0, ...used) + 1;
    let id = `R${next}`;
    while (db.riders.some((r) => r.id === id && r.restaurant_id === restaurant.id)) id = `R${++next}`;
    rider = { id, max_orders: maxOrders, assigned: 0, restaurant_id: restaurant.id, created_at: new Date().toISOString() };
    db.riders.push(rider);
  }

  const user = {
    id: newId('usr'), name: fields.name, email: fields.email, role: 'rider',
    password_hash: hashPassword(fields.password), active: true,
    restaurant_id: restaurant.id, rider_id: rider.id,
    invited_by: req.userId, created_at: new Date().toISOString(),
  };
  db.users.push(user);
  rider.user_id = user.id;
  store.save(db);
  res.status(201).json({ ...publicUser(user, db), active: true, rider: { id: rider.id, max_orders: rider.max_orders, assigned: rider.assigned } });
});

router.delete('/riders/:id', (req, res) => {
  if (req.role !== 'owner') throw new AppError(403, 'Only the owner can deactivate rider accounts.');
  const db = store.load();
  const user = db.users.find((u) => u.id === req.params.id && u.role === 'rider' && u.restaurant_id === req.restaurantId);
  if (!user) throw new AppError(404, 'Rider account not found in your restaurant.');
  const activeStatuses = ['Assigned', 'Preparing', 'Out for Delivery'];
  const hasActiveOrders = db.orders.some((o) => o.restaurant_id === req.restaurantId && o.rider_id === user.rider_id && activeStatuses.includes(o.status));
  if (hasActiveOrders) throw new AppError(409, 'Reassign or close this rider’s active orders before deactivating the account.');
  user.active = false;
  user.disabled_at = new Date().toISOString();
  db.sessions = db.sessions.filter((s) => s.user_id !== user.id);
  store.save(db);
  res.json({ ok: true });
});

module.exports = router;
