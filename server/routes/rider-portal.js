const express = require('express');
const store = require('../data/store');
const { mutate, loadFor } = require('./helpers');
const { AppError } = require('../logic/validation');
const ops = require('../logic/orders');

const router = express.Router();
const ACTIVE = ['Assigned', 'Preparing', 'Out for Delivery'];

function riderOrderView(order) {
  const total = Number(order.total_inr ?? (Number(order.basket_inr || 0) + Number(order.customer_fee_inr || 0)));
  return {
    id: order.id,
    customer: order.customer || 'Customer details unavailable',
    phone: order.phone || null,
    delivery_address: order.delivery_address || null,
    items: Array.isArray(order.items) ? order.items.map((item) => ({
      item_id: item.item_id || item.id || item.name,
      name: item.name || 'Menu item',
      quantity: Number(item.quantity) || 1,
    })) : [],
    restaurant_name: order.restaurant_name || null,
    status: order.status,
    rider_response: order.rider_response || 'Awaiting response',
    rider_response_at: order.rider_response_at || null,
    rider_response_reason: order.rider_response_reason || '',
    distance_km: Number(order.distance_km) || 0,
    promised_minutes: Number(order.deadline_minutes) || null,
    total_inr: Number.isFinite(total) ? total : null,
    payment_method: order.payment_method || null,
    payment_status: order.payment_status || null,
    created_at: order.created_at || null,
    assigned_at: order.assigned_at || order.updated_at || null,
  };
}

router.get('/orders', (req, res) => {
  if (!req.riderId) throw new AppError(403, 'This account is not linked to a rider profile.');
  const db = loadFor(req);
  const orders = db.orders
    .filter((order) => order.rider_id === req.riderId && ACTIVE.includes(order.status))
    .sort((a, b) => String(b.assigned_at || b.updated_at || '').localeCompare(String(a.assigned_at || a.updated_at || '')))
    .map(riderOrderView);
  res.json({ rider_id: req.riderId, orders });
});

router.post('/orders/:id/respond', (req, res) => {
  if (!req.riderId) throw new AppError(403, 'This account is not linked to a rider profile.');
  const action = String(req.body.action || '').trim().toLowerCase();
  if (!['accept', 'reject'].includes(action)) throw new AppError(400, 'Choose accept or reject.');
  const reason = String(req.body.reason || '').trim();
  if (action === 'reject' && (reason.length < 3 || reason.length > 240)) {
    throw new AppError(400, 'Enter a reason between 3 and 240 characters when rejecting an assignment.');
  }

  const result = mutate(req, (db) => {
    const order = db.orders.find((item) => item.id === req.params.id && item.rider_id === req.riderId);
    if (!order) throw new AppError(404, 'This order is not assigned to your rider account.');
    if (order.status !== 'Assigned') throw new AppError(409, `This assignment can no longer be responded to because its status is ${order.status}.`);
    if (order.rider_response === 'Accepted' || order.rider_response === 'Rejected') {
      throw new AppError(409, `You have already ${order.rider_response.toLowerCase()} this assignment.`);
    }

    const now = new Date().toISOString();
    order.rider_response = action === 'accept' ? 'Accepted' : 'Rejected';
    order.rider_response_at = now;
    order.rider_response_reason = action === 'reject' ? reason : '';
    order.updated_at = now;

    if (action === 'accept') {
      ops.logDecision(db, order, 'Rider accepted assignment', '', `Rider ${req.riderId} accepted delivery ${order.id}.`);
    } else {
      const rider = db.riders.find((item) => item.id === req.riderId);
      if (rider) rider.assigned = Math.max(0, Number(rider.assigned || 0) - 1);
      order.rejected_rider_id = req.riderId;
      order.status = 'Pending';
      order.rider_id = null;
      ops.logDecision(db, order, 'Rider rejected assignment', reason, `Rider ${req.riderId} rejected delivery ${order.id}; it returned to the dispatch queue.`);
    }
    return riderOrderView(order);
  });

  res.json({ ok: true, order: result });
});

module.exports = router;
