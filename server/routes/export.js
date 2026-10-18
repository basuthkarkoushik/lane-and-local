const express = require('express');
const { loadFor } = require('./helpers');
const { calculateContribution } = require('../logic/contribution');
const { evaluateOrder } = require('../logic/feasibility');

const router = express.Router();

function cell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // stops spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
}

function sendCsv(res, filename, columns, rows) {
  const header = columns.join(',');
  const body = rows.map((r) => columns.map((c) => cell(r[c])).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + [header, ...body].join('\r\n'));
}

router.get('/orders', (req, res) => {
  const db = loadFor(req);
  const rows = db.orders.map((o) => {
    const c = calculateContribution(o);
    const f = evaluateOrder(o, db.riders, db.config);
    return {
      id: o.id, status: o.status, rider_id: o.rider_id, basket_inr: o.basket_inr,
      merchant_fee_pct: o.merchant_fee_pct, customer_fee_inr: o.customer_fee_inr,
      rider_cost_inr: o.rider_cost_inr, support_inr: o.support_inr, payment_inr: o.payment_inr,
      distance_km: o.distance_km, deadline_minutes: o.deadline_minutes,
      contribution_inr: c.valid ? c.contribution_inr : null,
      feasibility: f.status, estimated_minutes: f.estimated_minutes, created_at: o.created_at, updated_at: o.updated_at,
    };
  });
  sendCsv(res, 'orders.csv', Object.keys(rows[0] || { id: '' }), rows);
});

router.get('/alerts', (req, res) => {
  const db = loadFor(req);
  const rows = db.alerts.map((a) => ({
    id: a.id, type: a.type, severity: a.severity, order_id: a.order_id, status: a.status,
    reason: a.reason, suggested_action: a.suggested_action, values: a.values,
    created_at: a.created_at, acknowledged_at: a.acknowledged_at, resolved_at: a.resolved_at,
    resolved_by: a.resolved_by, resolution: a.resolution,
  }));
  sendCsv(res, 'alerts.csv',
    ['id', 'type', 'severity', 'order_id', 'status', 'reason', 'suggested_action', 'values', 'created_at', 'acknowledged_at', 'resolved_at', 'resolved_by', 'resolution'],
    rows);
});

router.get('/history', (req, res) => {
  const db = loadFor(req);
  const rows = db.decisions.map((d) => ({
    id: d.id, order_id: d.order_id, decision: d.decision, reason: d.reason,
    explanation: d.explanation, assumptions: d.assumptions, by: d.by, timestamp: d.timestamp,
  }));
  sendCsv(res, 'decision-history.csv', ['id', 'order_id', 'decision', 'by', 'reason', 'explanation', 'assumptions', 'timestamp'], rows);
});

module.exports = router;