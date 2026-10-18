const express = require('express');

const store = require('../data/store');
const { mutate } = require('./helpers');
const c = require('../logic/customer');
const catalog = require('../logic/catalog');
const { AppError } = require('../logic/validation');

const router = express.Router();

/**
 * Calculate approximate straight-line distance between a customer's
 * current location and the restaurant's saved location.
 *
 * The raw customer coordinates are used for the calculation but are
 * not added to the order record by these routes.
 */
function customerDistanceKm(raw, restaurant) {
  const rawLatitude = raw.customer_latitude;
  const rawLongitude = raw.customer_longitude;

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
      'Allow location access so we can calculate your distance automatically.'
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
      'Allow location access so we can calculate your distance automatically.'
    );
  }

  const restaurantLatitude = Number(restaurant.latitude);
  const restaurantLongitude = Number(restaurant.longitude);

  if (
    restaurant.latitude === null ||
    restaurant.latitude === undefined ||
    restaurant.longitude === null ||
    restaurant.longitude === undefined ||
    !Number.isFinite(restaurantLatitude) ||
    !Number.isFinite(restaurantLongitude) ||
    restaurantLatitude < -90 ||
    restaurantLatitude > 90 ||
    restaurantLongitude < -180 ||
    restaurantLongitude > 180
  ) {
    throw new AppError(
      400,
      'This restaurant has not configured its map location yet. Please contact the restaurant owner.'
    );
  }

  const radians = (degrees) => (degrees * Math.PI) / 180;

  const latitudeDifference = radians(
    restaurantLatitude - latitude
  );

  const longitudeDifference = radians(
    restaurantLongitude - longitude
  );

  const a = Math.min(
    1,
    Math.max(
      0,
      Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(radians(latitude)) *
          Math.cos(radians(restaurantLatitude)) *
          Math.sin(longitudeDifference / 2) ** 2
    )
  );

  const distance =
    6371 *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return Math.round(distance * 10) / 10;
}

// Browse active restaurants.
// Coordinates are returned so the customer UI can calculate distance.
router.get('/restaurants', (req, res) => {
  const restaurants = catalog
    .listRestaurants(store.load())
    .map((restaurant) => ({
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      tagline: restaurant.tagline,
      cuisine: restaurant.cuisine,
      eta: restaurant.eta,
      rating: restaurant.rating,
      emoji: restaurant.emoji,
      accent: restaurant.accent,
      latitude: restaurant.latitude ?? null,
      longitude: restaurant.longitude ?? null,
      menu: restaurant.menu,
    }));

  res.json(restaurants);
});

// Estimate an order using server-calculated distance.
// This route is public; checkout and saved orders require customer auth.
router.post('/estimate', (req, res) => {
  const full = store.load();

  const restaurantId =
    String(req.body.restaurant_id || store.DEFAULT_RESTAURANT_ID);

  const restaurant = full.restaurants.find(
    (item) =>
      item.id === restaurantId &&
      item.active !== false
  );

  if (!restaurant) {
    throw new AppError(400, 'Choose a valid restaurant.');
  }

  const distanceKm = customerDistanceKm(req.body, restaurant);

  const tenant = store.viewForRestaurant(full, restaurantId);

  const estimate = c.estimate(tenant, {
    ...req.body,
    distance_km: distanceKm,
  });

  res.json({
    ...estimate,
    distance_km: distanceKm,
  });
});

// Premium membership
router.get('/premium', (req, res) => {
  res.json(
    c.membershipView(
      store.load(),
      req.user,
      req.userId
    )
  );
});

router.post('/premium/subscribe', (req, res) => {
  const membership = mutate(
    req,
    (db) => c.subscribePremium(db, req.user, req.userId)
  );

  res.status(201).json(membership);
});

router.post('/premium/cancel', (req, res) => {
  res.json(
    mutate(
      req,
      (db) => c.cancelPremium(db, req.user, req.userId)
    )
  );
});

// Place an order using server-calculated distance.
// The customer cannot supply or override distance_km directly.
router.post('/orders', (req, res) => {
  const restaurantId = String(req.body.restaurant_id || '');
  const full = store.load();

  const restaurant = full.restaurants.find(
    (item) =>
      item.id === restaurantId &&
      item.active !== false
  );

  if (!restaurant) {
    throw new AppError(400, 'Choose a valid restaurant.');
  }

  const distanceKm = customerDistanceKm(req.body, restaurant);

  const orderInput = {
    ...req.body,
    distance_km: distanceKm,
  };

  const out = mutate(
    req,
    (db) => {
      const order = c.createCustomerOrder(
        db,
        req.user,
        orderInput,
        { userId: req.userId }
      );

      return c.customerView(order, db);
    },
    { restaurantId }
  );

  res.status(201).json(out);
});

// List orders owned by the signed-in customer
router.get('/orders', (req, res) => {
  const db = store.load();

  const owned = c.listOwned(
    db,
    req.user,
    req.userId
  );

  res.json(
    owned.map((order) =>
      c.customerView(
        order,
        store.viewForRestaurant(
          db,
          order.restaurant_id || store.DEFAULT_RESTAURANT_ID
        )
      )
    )
  );
});

// Get one order owned by the signed-in customer
router.get('/orders/:id', (req, res) => {
  const db = store.load();

  const order = c.findOwned(
    db,
    req.params.id,
    req.user,
    req.userId
  );

  res.json(
    c.customerView(
      order,
      store.viewForRestaurant(
        db,
        order.restaurant_id || store.DEFAULT_RESTAURANT_ID
      )
    )
  );
});

// Cancel an order owned by the signed-in customer
router.post('/orders/:id/cancel', (req, res) => {
  const full = store.load();

  const order = c.findOwned(
    full,
    req.params.id,
    req.user,
    req.userId
  );

  const restaurantId =
    order.restaurant_id || store.DEFAULT_RESTAURANT_ID;

  const out = mutate(
    req,
    (db) => {
      const updated = c.cancelByCustomer(
        db,
        req.params.id,
        req.user,
        req.body.reason,
        req.userId
      );

      return c.customerView(updated, db);
    },
    { restaurantId }
  );

  res.json(out);
});

module.exports = router;