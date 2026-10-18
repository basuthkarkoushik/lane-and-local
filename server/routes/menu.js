const express = require('express');
const store = require('../data/store');
const { AppError } = require('../logic/validation');
const { newId } = require('../logic/security');

const router = express.Router();

function ownerRestaurant(req, db) {
  if (req.role !== 'owner') throw new AppError(403, 'Only the restaurant owner can manage menu items.');
  const restaurant = db.restaurants.find((r) => r.id === req.restaurantId && r.owner_user_id === req.userId && r.active !== false);
  if (!restaurant) throw new AppError(404, 'Your restaurant could not be found.');
  restaurant.menu = Array.isArray(restaurant.menu) ? restaurant.menu : [];
  return restaurant;
}

function cleanItem(body, current = {}) {
  const name = String(body.name ?? current.name ?? '').trim();
  const description = String(body.description ?? current.description ?? '').trim();
  const category = String(body.category ?? current.category ?? 'Mains').trim();
  const emoji = String(body.emoji ?? current.emoji ?? '🍽️').trim();
  const price = Number(body.price_inr ?? current.price_inr);
  if (name.length < 2 || name.length > 80) throw new AppError(400, 'Item name must be between 2 and 80 characters.');
  if (description.length > 180) throw new AppError(400, 'Description must be 180 characters or fewer.');
  if (!Number.isFinite(price) || price < 1 || price > 100000) throw new AppError(400, 'Enter a valid price from ₹1 to ₹100,000.');
  if (category.length < 2 || category.length > 40) throw new AppError(400, 'Category must be between 2 and 40 characters.');
  if (emoji.length > 8) throw new AppError(400, 'Emoji must be short.');
  return {
    name,
    description,
    category,
    emoji: emoji || '🍽️',
    price_inr: Math.round(price * 100) / 100,
    vegetarian: body.vegetarian === undefined ? current.vegetarian !== false : Boolean(body.vegetarian),
    availability: current.availability === 'paused' ? 'paused' : 'available',
  };
}

router.get('/', (req, res) => {
  const db = store.load();
  const restaurant = ownerRestaurant(req, db);
  res.json({ restaurant: { id: restaurant.id, name: restaurant.name }, items: restaurant.menu });
});

router.post('/', (req, res) => {
  const db = store.load();
  const restaurant = ownerRestaurant(req, db);
  const item = {
    id: newId('item'),
    ...cleanItem(req.body),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  restaurant.menu.push(item);
  restaurant.updated_at = new Date().toISOString();
  store.save(db);
  res.status(201).json(item);
});

router.put('/:id', (req, res) => {
  const db = store.load();
  const restaurant = ownerRestaurant(req, db);
  const item = restaurant.menu.find((entry) => entry.id === req.params.id);
  if (!item) throw new AppError(404, 'Menu item not found in your restaurant.');
  const cleaned = cleanItem(req.body, item);
  Object.assign(item, cleaned, { updated_at: new Date().toISOString() });
  restaurant.updated_at = new Date().toISOString();
  store.save(db);
  res.json(item);
});

router.post('/:id/availability', (req, res) => {
  const availability = String(req.body.availability || '');
  if (!['available', 'paused'].includes(availability)) throw new AppError(400, 'Availability must be available or paused.');
  const db = store.load();
  const restaurant = ownerRestaurant(req, db);
  const item = restaurant.menu.find((entry) => entry.id === req.params.id);
  if (!item) throw new AppError(404, 'Menu item not found in your restaurant.');
  item.availability = availability;
  item.active = availability === 'available';
  item.updated_at = new Date().toISOString();
  store.save(db);
  res.json(item);
});

router.delete('/:id', (req, res) => {
  const db = store.load();
  const restaurant = ownerRestaurant(req, db);
  const index = restaurant.menu.findIndex((entry) => entry.id === req.params.id);
  if (index < 0) throw new AppError(404, 'Menu item not found in your restaurant.');
  const [removed] = restaurant.menu.splice(index, 1);
  restaurant.updated_at = new Date().toISOString();
  store.save(db);
  res.json({ ok: true, id: removed.id });
});

module.exports = router;
