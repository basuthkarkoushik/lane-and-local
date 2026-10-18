const express = require('express');
const { loadFor } = require('./helpers');
const { calculateContribution } = require('../logic/contribution');
const { evaluateOrder } = require('../logic/feasibility');
const { riderCapacity } = require('../logic/riders');

const router = express.Router();
const STATUSES = ['Pending', 'Assigned', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];
const round2 = (n) => Math.round(n * 100) / 100;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const hasRefund = (o) => o.refund_inr !== null && o.refund_inr !== undefined && Number.isFinite(Number(o.refund_inr));

router.get('/', (req, res) => {
  const db = loadFor(req);
  const total = db.orders.length;

  const by_status = STATUSES.map((s) => ({ status: s, count: db.orders.filter((o) => o.status === s).length }));

  const live = db.orders
    .filter((o) => o.status !== 'Cancelled')
    .map((o) => ({ o, calc: calculateContribution(o) }))
    .filter((e) => e.calc.valid);

  const contribution_by_order = live.map((e) => ({ order: e.o.id, contribution: round2(e.calc.contribution_inr - (hasRefund(e.o) ? Number(e.o.refund_inr) : 0)) }));
  const profitable = live.filter((e) => e.calc.contribution_inr >= 0).length;
  const unprofitable = live.length - profitable;

  const delivered = db.orders.filter((o) => o.status === 'Delivered' && o.actual_minutes !== null && o.actual_minutes !== undefined && Number.isFinite(Number(o.actual_minutes)));
  const onTime = delivered.filter((o) => Number(o.actual_minutes) <= Number(o.deadline_minutes)).length;
  const cancelled = db.orders.filter((o) => o.status === 'Cancelled').length;

  // A flagged order is a non-cancelled order with any non-green feasibility check,
  // a negative/invalid contribution, or an active alert. Cancelled orders are
  // excluded from the denominator so the rate reflects orders the team could act on.
  const activeAlertsByOrder = new Set(db.alerts.filter((a) => a.status !== 'Resolved').map((a) => a.order_id));
  const eligibleForFlags = db.orders.filter((o) => o.status !== 'Cancelled');
  const flaggedOrders = eligibleForFlags.filter((o) => {
    const calc = calculateContribution(o);
    const feasibility = evaluateOrder(o, db.riders, db.config);
    return activeAlertsByOrder.has(o.id) || !calc.valid || calc.contribution_inr < 0 || feasibility.status !== 'Green' || (o.status === 'Delivered' && Number.isFinite(Number(o.actual_minutes)) && Number(o.actual_minutes) > Number(o.deadline_minutes));
  });

  const rider_utilization = riderCapacity(db.riders).map((r) => ({
    rider: r.id, assigned: r.assigned, max_orders: r.max_orders, utilization_pct: r.utilization_pct,
  }));

  // Refunds: the fixture has no refund data, so this stays empty unless orders carry refund_inr
  const refunded = db.orders.filter(hasRefund);
  const refunds = refunded.length
    ? {
        available: true,
        total_refunds: round2(refunded.reduce((s, o) => s + Number(o.refund_inr), 0)),
        contribution_after_refunds: round2(
          live.reduce((s, e) => s + e.calc.contribution_inr - (hasRefund(e.o) ? Number(e.o.refund_inr) : 0), 0)
        ),
        contribution_after_refunds_per_order: live.length ? round2(live.reduce((s, e) => s + e.calc.contribution_inr - (hasRefund(e.o) ? Number(e.o.refund_inr) : 0), 0) / live.length) : null,
      }
    : { available: false };

  res.json({
    total_orders: total,
    by_status,
    contribution_by_order,
    profitable_vs_unprofitable: { profitable, unprofitable },
    on_time: { delivered_with_time: delivered.length, on_time: onTime, pct: pct(onTime, delivered.length) },
    cancellation: { cancelled, pct: pct(cancelled, total) },
    flagged_orders: { count: flaggedOrders.length, eligible_orders: eligibleForFlags.length, pct: pct(flaggedOrders.length, eligibleForFlags.length) },
    rider_utilization,
    refunds,
  });
});

module.exports = router;