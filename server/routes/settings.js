const express = require('express');

const store = require('../data/store');
const { mutate, loadFor } = require('./helpers');
const { AppError } = require('../logic/validation');
const { DEFAULTS } = require('../logic/feasibility');
const actor = require('../logic/actor');

const router = express.Router();

const FIELDS = {
  service_radius_km: 0.5,
  prep_minutes: 0,
  handover_minutes: 0,
  speed_kmph: 1,
  later_slot_minutes: 5,
  thin_margin_inr: 0,
};

function getOwnedRestaurant(req) {
  const db = store.load();

  const restaurant = db.restaurants.find(
    (item) =>
      item.id === req.restaurantId &&
      item.owner_user_id === req.userId
  );

  if (!restaurant) {
    throw new AppError(
      404,
      'Restaurant not found for this owner.'
    );
  }

  return { db, restaurant };
}

// Existing settings endpoint.
router.get('/', (req, res) => {
  const db = loadFor(req);
  res.json({ ...DEFAULTS, ...db.config });
});

// Get the current owner's restaurant location.
router.get('/location', (req, res) => {
  if (req.role !== 'owner') {
    throw new AppError(
      403,
      'Only the restaurant owner can manage restaurant location.'
    );
  }

  const { restaurant } = getOwnedRestaurant(req);

  res.json({
    restaurant_id: restaurant.id,
    restaurant_name: restaurant.name,
    latitude:
      restaurant.latitude !== null &&
      restaurant.latitude !== undefined &&
      Number.isFinite(Number(restaurant.latitude))
        ? Number(restaurant.latitude)
        : null,
    longitude:
      restaurant.longitude !== null &&
      restaurant.longitude !== undefined &&
      Number.isFinite(Number(restaurant.longitude))
        ? Number(restaurant.longitude)
        : null,
  });
});

// Save the current owner's restaurant location.
router.put('/location', (req, res) => {
  if (req.role !== 'owner') {
    throw new AppError(
      403,
      'Only the restaurant owner can manage restaurant location.'
    );
  }

  const rawLatitude = req.body.latitude;
  const rawLongitude = req.body.longitude;

  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);

  if (
    rawLatitude === undefined ||
    rawLatitude === null ||
    rawLatitude === '' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new AppError(
      400,
      'Latitude must be a number between -90 and 90.'
    );
  }

  if (
    rawLongitude === undefined ||
    rawLongitude === null ||
    rawLongitude === '' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new AppError(
      400,
      'Longitude must be a number between -180 and 180.'
    );
  }

  const { db, restaurant } = getOwnedRestaurant(req);

  restaurant.latitude = latitude;
  restaurant.longitude = longitude;
  restaurant.location_updated_at = new Date().toISOString();

  // Persist through the configured store:
  // PostgreSQL when DATABASE_URL is set, otherwise db.json.
  store.save(db);

  res.json({
    restaurant_id: restaurant.id,
    restaurant_name: restaurant.name,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    location_updated_at: restaurant.location_updated_at,
  });
});

// Existing operational settings update.
router.put('/', (req, res) => {
  const updates = {};
  const errors = [];

  Object.entries(FIELDS).forEach(([key, min]) => {
    const raw = req.body[key];

    if (raw === undefined) return;

    const value = Number(raw);

    if (
      raw === '' ||
      raw === null ||
      !Number.isFinite(value)
    ) {
      errors.push(`${key} must be a number`);
    } else if (value < min) {
      errors.push(`${key} must be at least ${min}`);
    } else {
      updates[key] = value;
    }
  });

  if (errors.length) {
    throw new AppError(400, errors.join('; '));
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'No settings to update');
  }

  const result = mutate(req, (db) => {
    const before = { ...DEFAULTS, ...db.config };
    db.config = { ...before, ...updates };

    const explanation = Object.entries(updates)
      .map(
        ([key, value]) =>
          `${key}: ${before[key]} → ${value}`
      )
      .join(', ');

    db.decisions.push({
      id: `DEC${db.decisions.length + 1}`,
      order_id: 'SETTINGS',
      restaurant_id: req.restaurantId,
      decision: 'Settings changed',
      reason: req.body.reason || '',
      explanation,
      assumptions: updates,
      by: actor.get(),
      timestamp: new Date().toISOString(),
    });

    return db.config;
  });

  res.json(result);
});

// Existing demo reset endpoint.
router.post('/reset', (req, res) => {
  const fixture = require(
    '../../Starter_Data/C26/fixture.json'
  );

  const result = mutate(req, (db) => {
    const restaurantId = req.restaurantId;

    if (restaurantId === store.DEFAULT_RESTAURANT_ID) {
      const now = new Date().toISOString();

      db.orders = fixture.records.orders.map((order) => ({
        ...order,
        status: 'Pending',
        rider_id: null,
        restaurant_id: restaurantId,
        created_at: now,
        updated_at: now,
      }));

      db.riders = fixture.records.riders.map((rider) => ({
        ...rider,
        restaurant_id: restaurantId,
      }));
    } else {
      db.orders = [];
      db.riders = [];
    }

    db.alerts = [];
    db.decisions = [];
    db.config = { ...DEFAULTS, ...db.config };

    return { ok: true };
  });

  res.json(result);
});

module.exports = router;