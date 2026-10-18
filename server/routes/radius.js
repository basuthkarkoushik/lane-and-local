const express = require('express');
const store = require('../data/store');
const { mutate, loadFor } = require('./helpers');
const { AppError } = require('../logic/validation');
const { DEFAULTS } = require('../logic/feasibility');
const { compareRadii } = require('../logic/radius');

const router = express.Router();

function parseKm(value, label) {
  const n = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(n) || n < 0.5 || n > 50) {
    throw new AppError(400, `${label} must be a number from 0.5 to 50 km`);
  }
  return n;
}

// GET /api/radius/compare?radii=2,3,5&proposed=5
router.get('/compare', (req, res) => {
  const db = loadFor(req);
  const current = Number({ ...DEFAULTS, ...db.config }.service_radius_km);
  const raw = req.query.radii ? String(req.query.radii).split(',') : ['2', '3', '5'];
  if (raw.length > 8) throw new AppError(400, 'Compare at most 8 radii at a time');
  const radii = raw.map((r) => parseKm(r.trim(), 'Each radius'));
  const proposed = req.query.proposed !== undefined ? parseKm(req.query.proposed, 'proposed') : Math.max(...radii);
  res.json(compareRadii(db, radii, current, proposed));
});

// Approve (changes the radius) or Decline (only records the decision)
router.post('/apply', (req, res) => {
  if (req.body.confirm !== true) throw new AppError(400, 'Please confirm before changing the service radius');
  const decision = req.body.decision || 'Approve';
  if (!['Approve', 'Decline'].includes(decision)) throw new AppError(400, 'decision must be Approve or Decline');
  const proposed = parseKm(req.body.proposed_km, 'proposed_km');
  const reason = String(req.body.reason || '').trim();
  if (!reason) throw new AppError(400, 'A reason is required');

  const out = mutate(req, (db) => {
    const cfg = { ...DEFAULTS, ...db.config };
    const original = Number(cfg.service_radius_km);
    if (proposed === original) throw new AppError(400, 'Proposed radius is the same as the current radius');

    const cmp = compareRadii(db, [original, proposed], original, proposed);
    const finalKm = decision === 'Approve' ? proposed : original;
    if (decision === 'Approve') db.config = { ...cfg, service_radius_km: proposed };

    db.decisions.push({
      id: `DEC${db.decisions.length + 1}`,
      order_id: 'RADIUS',
      restaurant_id: req.restaurantId,
      decision: decision === 'Approve' ? 'Radius change approved' : 'Radius change declined',
      reason,
      explanation: cmp.explanation,
      assumptions: { original_km: original, proposed_km: proposed, final_km: finalKm },
      timestamp: new Date().toISOString(),
    });
    return { service_radius_km: finalKm, decision };
  });
  res.json(out);
});

module.exports = router;