const express = require('express');
const { loadFor } = require('./helpers');

const router = express.Router();

// GET /api/history?q=OD1&decision=Accepted
router.get('/', (req, res) => {
  const db = loadFor(req);
  const { q, decision } = req.query;
  let list = db.decisions.slice().reverse();
  if (decision) list = list.filter((d) => d.decision === decision);
  if (q) {
    const s = String(q).toLowerCase();
    list = list.filter((d) => `${d.order_id} ${d.decision} ${d.reason} ${d.explanation}`.toLowerCase().includes(s));
  }
  res.json({
    decisions: list,
    decision_types: [...new Set(db.decisions.map((d) => d.decision))],
  });
});

module.exports = router;