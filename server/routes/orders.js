const express = require('express');
const store = require('../data/store');
const { mutate, loadFor } = require('./helpers');
const { AppError, validateOrderInput } = require('../logic/validation');
const { calculateContribution } = require('../logic/contribution');
const { evaluateOrder } = require('../logic/feasibility');
const ops = require('../logic/orders');

const router = express.Router();

const NUMERIC = [
  'basket_inr', 'merchant_fee_pct', 'customer_fee_inr', 'rider_cost_inr',
  'support_inr', 'payment_inr', 'distance_km', 'deadline_minutes',
];
const EDITABLE = ['customer', 'phone', 'delivery_address', ...NUMERIC];
const COST_FIELDS = ['merchant_fee_pct', 'customer_fee_inr', 'rider_cost_inr', 'support_inr', 'payment_inr'];

function pick(body) {
  const out = {};
  EDITABLE.forEach((k) => {
    if (body[k] !== undefined && ['customer', 'phone', 'delivery_address'].includes(k)) {
      out[k] = String(body[k] ?? '').trim();
    } else if (body[k] !== undefined) out[k] = body[k];
  });
  if (out.customer !== undefined && out.customer.length > 80) throw new AppError(400, 'Customer name must be 80 characters or fewer.');
  if (out.phone) {
    let phone = String(out.phone).replace(/\D/g, '');
    if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
    if (!/^\d{10}$/.test(phone)) throw new AppError(400, 'Enter a valid 10-digit customer phone number.');
    out.phone = phone;
  }
  if (out.delivery_address && (out.delivery_address.length < 8 || out.delivery_address.length > 240)) {
    throw new AppError(400, 'Delivery address must be between 8 and 240 characters.');
  }
  NUMERIC.forEach((k) => {
    const v = out[k];
    if (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v))) out[k] = Number(v);
  });
  return out;
}

function operationalRiders(db, restaurantId) {
  return db.riders.filter((r) => db.users.some((u) => u.role === 'rider' && u.rider_id === r.id && u.restaurant_id === restaurantId && u.active !== false));
}

function detail(db, order) {
  return {
    ...order,
    contribution: calculateContribution(order),
    feasibility: evaluateOrder(order, operationalRiders(db, db._restaurantId || null), db.config),
  };
}

// List (optional ?status=Pending&q=OD1)
router.get('/', (req, res) => {
  const db = loadFor(req);
  const { status, q } = req.query;
  let list = db.orders;
  if (status) list = list.filter((o) => o.status === status);
  if (q) {
    const s = String(q).toLowerCase();
    list = list.filter((o) => o.id.toLowerCase().includes(s) || String(o.customer || '').toLowerCase().includes(s));
  }
  res.json(list.map((o) => detail(db, o)));
});

// One order with its history and alerts
router.get('/:id', (req, res) => {
  const db = loadFor(req);
  const order = ops.findOrder(db, req.params.id);
  res.json({
    ...detail(db, order),
    decisions: db.decisions.filter((d) => d.order_id === order.id),
    alerts: db.alerts.filter((a) => a.order_id === order.id),
  });
});

// New quote
router.post('/', (req, res) => {
  const input = pick(req.body);
  input.id = String(req.body.id || '').trim();
  const check = validateOrderInput(input);
  if (!check.valid) throw new AppError(400, check.errors.join('; '));

  const created = mutate(req, (db) => {
    if (store.load().orders.some((o) => o.id.toLowerCase() === input.id.toLowerCase())) {
      throw new AppError(409, `Order ${input.id} already exists`);
    }
    const now = new Date().toISOString();
    const order = { ...input, status: 'Pending', rider_id: null, restaurant_id: req.restaurantId, created_at: now, updated_at: now };
    db.orders.push(order);
    ops.logDecision(db, order, 'Quote created', req.body.reason || '', 'New delivery quote saved.');
    return detail(db, order);
  });
  res.status(201).json(created);
});

// Edit a quote / order (not allowed once Delivered or Cancelled)
router.put('/:id', (req, res) => {
  const input = pick(req.body);
  const check = validateOrderInput(input, { partial: true });
  if (!check.valid) throw new AppError(400, check.errors.join('; '));

  const updated = mutate(req, (db) => {
    const order = ops.findOrder(db, req.params.id);
    if (['Delivered', 'Cancelled'].includes(order.status)) {
      throw new AppError(400, `Cannot edit an order that is ${order.status}`);
    }
    const changes = {};
    Object.keys(input).forEach((k) => {
      if (order[k] !== input[k]) {
        changes[k] = { from: order[k], to: input[k] };
        order[k] = input[k];
      }
    });
    if (Object.keys(changes).length === 0) return detail(db, order);

    const costKeys = Object.keys(changes).filter((k) => COST_FIELDS.includes(k));
    if (costKeys.length > 0) {
      const costChange = {};
      costKeys.forEach((k) => (costChange[k] = changes[k]));
      order.cost_changes = [...(order.cost_changes || []), { at: new Date().toISOString(), changes: costChange }];
    }
    order.updated_at = new Date().toISOString();
    const text = Object.entries(changes).map(([k, v]) => `${k}: ${v.from} → ${v.to}`).join(', ');
    ops.logDecision(db, order, 'Edited', req.body.reason || '', `Changed ${text}.`);
    return detail(db, order);
  });
  res.json(updated);
});

// Assign a rider
router.post('/:id/assign', (req, res) => {
  if (!req.body.rider_id) throw new AppError(400, 'rider_id is required');
  const out = mutate(req, (db) => {
    const linkedUser = db.users.find((u) => u.role === 'rider' && u.rider_id === String(req.body.rider_id) && u.restaurant_id === req.restaurantId && u.active !== false);
    if (!linkedUser) throw new AppError(409, `Rider ${req.body.rider_id} does not have an active sign-in account. Ask the owner to register the rider first.`);
    const order = ops.assignRider(db, req.params.id, req.body.rider_id, req.body.reason);
    return detail(db, order);
  });
  res.json(out);
});

// Record the cumulative refund amount for an order. Owners only; the reason is audited.
router.post('/:id/refund', (req, res) => {
  if (req.role !== 'owner') throw new AppError(403, 'Only the restaurant owner can record refunds.');
  const amount = Number(req.body.refund_inr);
  const reason = String(req.body.reason || '').trim();
  if (!Number.isFinite(amount) || amount < 0) throw new AppError(400, 'Refund must be a non-negative amount.');
  if (amount > 1000000) throw new AppError(400, 'Refund amount is too large.');
  if (!reason || reason.length < 3 || reason.length > 240) throw new AppError(400, 'Enter a refund reason between 3 and 240 characters.');
  const out = mutate(req, (db) => {
    const order = ops.findOrder(db, req.params.id);
    const paidTotal = Number(order.total_inr ?? order.basket_inr ?? order.basket_value_inr ?? 0);
    if (paidTotal > 0 && amount > paidTotal) throw new AppError(400, `Refund cannot exceed the recorded order total of ₹${paidTotal}.`);
    const previous = Number(order.refund_inr) || 0;
    order.refund_inr = Math.round(amount * 100) / 100;
    order.refund_updated_at = new Date().toISOString();
    order.updated_at = new Date().toISOString();
    ops.logDecision(db, order, 'Refund recorded', reason, `Cumulative refund changed from ₹${previous} to ₹${order.refund_inr}.`);
    return detail(db, order);
  });
  res.json(out);
});

// Change status (Preparing, Out for Delivery, Delivered)
router.post('/:id/status', (req, res) => {
  const { status, reason, actual_minutes } = req.body;
  const actual =
    actual_minutes === undefined || actual_minutes === null || actual_minutes === '' ? null : Number(actual_minutes);
  if (actual !== null && (Number.isNaN(actual) || actual < 0)) {
    throw new AppError(400, 'actual_minutes must be a non-negative number');
  }
  const out = mutate(req, (db) => {
    const order = ops.updateStatus(db, req.params.id, status, reason, { actual_minutes: actual });
    return detail(db, order);
  });
  res.json(out);
});

// Cancel (reason required)
router.post('/:id/cancel', (req, res) => {
  const out = mutate(req, (db) => detail(db, ops.cancelOrder(db, req.params.id, req.body.reason)));
  res.json(out);
});

// Accept / Reject / Reschedule (reason required)
router.post('/:id/decision', (req, res) => {
  const out = mutate(req, (db) => {
    const riderPool = operationalRiders(db, req.restaurantId);
    return detail(db, ops.decideOrder(db, req.params.id, req.body.decision, req.body.reason, riderPool));
  });
  res.json(out);
});
// Report a restaurant preparation delay (0 clears it)
router.post('/:id/prep-delay', (req, res) => {
  const minutes = Number(req.body.minutes);
  if (req.body.minutes === undefined || req.body.minutes === '' || Number.isNaN(minutes) || minutes < 0 || minutes > 240) {
    throw new AppError(400, 'minutes must be a number from 0 to 240');
  }
  const out = mutate(req, (db) => {
    const order = ops.findOrder(db, req.params.id);
    if (!['Pending', 'Assigned', 'Preparing'].includes(order.status)) {
      throw new AppError(400, `Cannot report a preparation delay for a ${order.status} order`);
    }
    order.prep_delay_minutes = minutes;
    order.updated_at = new Date().toISOString();
    ops.logDecision(
      db, order,
      minutes > 0 ? 'Prep delay reported' : 'Prep delay cleared',
      req.body.reason || '',
      `Restaurant preparation delay set to ${minutes} min.`
    );
    return detail(db, order);
  });
  res.json(out);
});
// Live preview for the quote form (nothing is saved)
router.post('/preview', (req, res) => {
  const db = loadFor(req);
  const input = pick(req.body);
  const check = validateOrderInput({ id: 'PREVIEW', ...input });
  if (!check.valid) return res.json({ valid: false, errors: check.errors });
  const order = { ...input, id: 'PREVIEW', status: 'Pending', rider_id: null };
  res.json({
    valid: true,
    contribution: calculateContribution(order),
    feasibility: evaluateOrder(order, operationalRiders(db, db._restaurantId || req.restaurantId), db.config),
  });
});
module.exports = router;