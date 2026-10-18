const express = require('express');
const store = require('../data/store');
const { mutate, loadFor } = require('./helpers');
const { AppError } = require('../logic/validation');
const { riderCapacity, totalAvailable, recommendRider } = require('../logic/riders');
const { evaluateOrder, estimateDeliveryMinutes, DEFAULTS } = require('../logic/feasibility');

const router = express.Router();
const ACTIVE = ['Assigned', 'Preparing', 'Out for Delivery'];

router.get('/', (req, res) => {
  const db = loadFor(req);
  const cfg = { ...DEFAULTS, ...db.config };
  const registeredRiders = db.riders.filter((r) => db.users.some((u) => u.role === 'rider' && u.rider_id === r.id && u.restaurant_id === req.restaurantId && u.active !== false));

  // Pending orders a free rider could take (profit, radius and time are not Red)
  const eligible = db.orders
    .filter((o) => o.status === 'Pending')
    .filter((o) => {
      const f = evaluateOrder(o, registeredRiders, db.config);
      return ['profit', 'radius', 'timing'].every((k) => f.checks[k].status !== 'Red');
    })
    .map((o) => o.id);

  const riders = riderCapacity(db.riders).map((r) => {
    const account = db.users.find((u) => u.role === 'rider' && u.rider_id === r.id && u.restaurant_id === req.restaurantId);
    const accountRegistered = Boolean(account && account.active !== false);
    const linked = db.orders.filter((o) => o.rider_id === r.id && ACTIVE.includes(o.status));
    return {
      ...r,
      account_registered: accountRegistered,
      account_name: account?.name || null,
      account_email: account?.email || null,
      status: accountRegistered ? r.status : 'Not registered',
      current_orders: linked.map((o) => o.id),
      // Starting counts from fixture.json have no order attached
      unlinked_assignments: Math.max(0, r.assigned - linked.length),
      workload_minutes: linked.reduce((sum, o) => sum + estimateDeliveryMinutes(o, cfg), 0),
      eligible_orders: accountRegistered && r.remaining > 0 ? eligible : [],
    };
  });

  const available = totalAvailable(registeredRiders);
  const best = recommendRider(registeredRiders);
  res.json({
    riders,
    summary: {
      total_riders: riders.length,
      available_riders: riders.filter((r) => r.account_registered && r.remaining > 0).length,
      busy_riders: riders.filter((r) => r.account_registered && r.remaining === 0).length,
      unregistered_riders: riders.filter((r) => !r.account_registered).length,
      available_capacity: available,
      recommended_rider: best ? best.id : null,
      later_slot_minutes: available === 0 ? cfg.later_slot_minutes : null,
    },
  });
});

router.post('/', (req, res) => {
  const id = String(req.body.id || '').trim();
  const max = Number(req.body.max_orders);
  if (!id) throw new AppError(400, 'Rider id is required');
  if (!Number.isInteger(max) || max < 1) throw new AppError(400, 'max_orders must be a whole number of at least 1');
  mutate(req, (db) => {
    if (db.riders.some((r) => r.id.toLowerCase() === id.toLowerCase())) throw new AppError(409, `Rider ${id} already exists`);
    db.riders.push({ id, max_orders: max, assigned: 0, restaurant_id: req.restaurantId });
  });
  res.status(201).json({ ok: true });
});

router.put('/:id', (req, res) => {
  const max = Number(req.body.max_orders);
  if (!Number.isInteger(max) || max < 1) throw new AppError(400, 'max_orders must be a whole number of at least 1');
  mutate(req, (db) => {
    const rider = db.riders.find((r) => r.id === req.params.id);
    if (!rider) throw new AppError(404, `Rider ${req.params.id} not found`);
    if (max < rider.assigned) throw new AppError(409, `Rider already has ${rider.assigned} assigned orders. Capacity cannot be lower.`);
    rider.max_orders = max;
  });
  res.json({ ok: true });
});

module.exports = router;