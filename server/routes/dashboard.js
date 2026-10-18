const express = require('express');
const { loadFor } = require('./helpers');
const { calculateContribution } = require('../logic/contribution');
const { evaluateOrder } = require('../logic/feasibility');
const { totalAvailable, riderCapacity } = require('../logic/riders');

const router = express.Router();
const round2 = (n) => Math.round(n * 100) / 100;
const FINAL = ['Delivered', 'Cancelled'];

router.get('/', (req, res) => {
  const db = loadFor(req);

  const restaurantId = db._restaurantId || req.restaurantId || null;
  // Only riders with an active login count as operational delivery capacity.
  // Legacy fixture profiles stay visible in Rider Management until the owner
  // registers them, but should not inflate the Overview availability figures.
  const operationalRiders = db.riders.filter((r) =>
    db.users.some((u) => u.role === 'rider' && u.rider_id === r.id && u.restaurant_id === restaurantId && u.active !== false)
  );

  const counted = db.orders
    .filter((o) => o.status !== 'Cancelled')
    .map((o) => ({ o, calc: calculateContribution(o), f: evaluateOrder(o, operationalRiders, db.config) }));
  const valid = counted.filter((e) => e.calc.valid);
  const total = valid.reduce((s, e) => s + e.calc.contribution_inr, 0);

  const atRisk = counted.filter((e) => !FINAL.includes(e.o.status) && e.f.checks.timing.status === 'Red').length;

  const delivered = db.orders.filter((o) => o.status === 'Delivered' && o.actual_minutes !== undefined && o.actual_minutes !== null);
  const onTimePct = delivered.length
    ? Math.round((delivered.filter((o) => o.actual_minutes <= o.deadline_minutes).length / delivered.length) * 1000) / 10
    : null;

  const caps = riderCapacity(operationalRiders);
  const activeAlerts = db.alerts.filter((a) => a.status !== 'Resolved');

  res.json({
    total_orders: db.orders.length,
    pending_orders: db.orders.filter((o) => o.status === 'Pending').length,
    available_riders: caps.filter((r) => r.remaining > 0).length,
    busy_riders: caps.filter((r) => r.remaining === 0).length,
    available_capacity: totalAvailable(operationalRiders),
    at_risk_orders: atRisk,
    unprofitable_orders: valid.filter((e) => e.calc.is_loss).length,
    total_contribution: round2(total),
    avg_contribution: valid.length ? round2(total / valid.length) : null,
    on_time_pct: onTimePct,
    delivered_count: delivered.length,
    recent_orders: db.orders
      .slice()
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 5)
      .map((o) => ({ id: o.id, status: o.status, rider_id: o.rider_id, updated_at: o.updated_at })),
    active_alerts: activeAlerts.slice(0, 5),
    active_alert_count: activeAlerts.length,
    chart: valid.map((e) => ({
      order: e.o.id,
      contribution: e.calc.contribution_inr,
      estimated_minutes: e.f.estimated_minutes,
      promised_minutes: e.o.deadline_minutes,
    })),
  });
});

module.exports = router;