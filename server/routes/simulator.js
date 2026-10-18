const express = require('express');
const store = require('../data/store');
const { mutate, loadFor } = require('./helpers');
const { AppError } = require('../logic/validation');
const { findOrder } = require('../logic/orders');
const { simulate, applyScenario } = require('../logic/simulator');

const router = express.Router();

// Preview only. Nothing is saved.
router.post('/simulate', (req, res) => {
  if (!req.body.order_id) throw new AppError(400, 'order_id is required');
  const db = loadFor(req);
  res.json(simulate(db, findOrder(db, req.body.order_id), req.body.overrides));
});

// Saves the scenario. Needs confirm: true and a reason.
router.post('/apply', (req, res) => {
  if (!req.body.order_id) throw new AppError(400, 'order_id is required');
  if (req.body.confirm !== true) throw new AppError(400, 'Please confirm before applying a scenario');
  const out = mutate(req, (db) =>
    applyScenario(db, findOrder(db, req.body.order_id), req.body.overrides, req.body.reason)
  );
  res.json(out);
});

module.exports = router;