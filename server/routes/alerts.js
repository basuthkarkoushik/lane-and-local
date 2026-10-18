const express = require('express');
const { mutate, loadFor } = require('./helpers');
const { AppError } = require('../logic/validation');
const { logDecision } = require('../logic/orders');

const router = express.Router();

router.get('/', (req, res) => {
  const all = mutate(req, (db) => db.alerts); // recalculates first, then returns
  const { severity, status, type, order_id, q } = req.query;

  let list = all.slice().reverse();
  if (severity) list = list.filter((a) => a.severity === severity);
  if (status === 'Active') list = list.filter((a) => a.status !== 'Resolved');
  else if (status) list = list.filter((a) => a.status === status);
  if (type) list = list.filter((a) => a.type === type);
  if (order_id) list = list.filter((a) => a.order_id === order_id);
  if (q) {
    const s = String(q).toLowerCase();
    list = list.filter((a) => `${a.order_id} ${a.type} ${a.reason}`.toLowerCase().includes(s));
  }

  const active = all.filter((a) => a.status !== 'Resolved');
  res.json({
    alerts: list,
    counts: {
      active: active.length,
      critical: active.filter((a) => a.severity === 'Critical').length,
      warning: active.filter((a) => a.severity === 'Warning').length,
      informational: active.filter((a) => a.severity === 'Informational').length,
      resolved: all.length - active.length,
    },
  });
});

router.get('/:id', (req, res) => {
  const all = mutate(req, (db) => db.alerts);
  const alert = all.find((a) => a.id === req.params.id);
  if (!alert) throw new AppError(404, `Alert ${req.params.id} not found`);
  res.json(alert);
});

router.post('/:id/acknowledge', (req, res) => {
  const out = mutate(req, (db) => {
    const a = db.alerts.find((x) => x.id === req.params.id);
    if (!a) throw new AppError(404, `Alert ${req.params.id} not found`);
    if (a.status === 'Resolved') throw new AppError(400, 'This alert is already resolved');
    if (a.status === 'Acknowledged') return a;
    a.status = 'Acknowledged';
    a.acknowledged_at = new Date().toISOString();
    a.updated_at = a.acknowledged_at;
    return a;
  });
  res.json(out);
});

router.post('/:id/resolve', (req, res) => {
  const resolution = String(req.body.resolution || '').trim();
  if (!resolution) throw new AppError(400, 'Resolution details are required');
  const out = mutate(req, (db) => {
    const a = db.alerts.find((x) => x.id === req.params.id);
    if (!a) throw new AppError(404, `Alert ${req.params.id} not found`);
    if (a.status === 'Resolved') throw new AppError(400, 'This alert is already resolved');
    const now = new Date().toISOString();
    a.status = 'Resolved';
    a.resolved_at = now;
    a.updated_at = now;
    a.resolved_by = 'user';
    a.resolution = resolution;
    a.condition_cleared = false; // recalculated right after this
    const order = db.orders.find((o) => o.id === a.order_id);
    if (order) logDecision(db, order, 'Alert resolved', resolution, `${a.type} (${a.severity}).`);
    return a;
  });
  res.json(out);
});

module.exports = router;