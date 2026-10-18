const { calculateContribution } = require('./contribution');
const { evaluateOrder } = require('./feasibility');
const { validateOrderInput, AppError } = require('./validation');
const { logDecision } = require('./orders');

// Distance is adjustable (it changes delivery time and the radius check).
// The fixture has no per-km rider rate, so rider cost is NOT auto-scaled by distance.
const SIM_FIELDS = ['merchant_fee_pct', 'customer_fee_inr', 'rider_cost_inr', 'support_inr', 'payment_inr', 'distance_km'];
const COST_FIELDS = ['merchant_fee_pct', 'customer_fee_inr', 'rider_cost_inr', 'support_inr', 'payment_inr'];
const FINAL = ['Delivered', 'Cancelled'];

const money = (n) => (n < 0 ? `-₹${Math.abs(n)}` : `₹${n}`);

function cleanOverrides(overrides = {}) {
  const out = {};
  SIM_FIELDS.forEach((k) => {
    const v = overrides[k];
    if (v !== undefined && v !== null && v !== '') out[k] = Number(v);
  });
  const check = validateOrderInput(out, { partial: true });
  if (!check.valid) throw new AppError(400, check.errors.join('; '));
  return out;
}

function snapshot(order, db) {
  const calc = calculateContribution(order);
  return {
    contribution: calc.valid ? calc.contribution_inr : null,
    breakdown: calc,
    feasibility: evaluateOrder(order, db.riders, db.config),
  };
}

// Pure calculation. Never changes the saved order.
function simulate(db, order, overrides) {
  const cleaned = cleanOverrides(overrides);
  const simOrder = { ...order, ...cleaned };

  const changes = Object.keys(cleaned)
    .filter((k) => Number(order[k]) !== cleaned[k])
    .map((k) => ({ field: k, from: order[k], to: cleaned[k] }));

  const original = snapshot(order, db);
  const simulated = snapshot(simOrder, db);

  const difference =
    original.contribution !== null && simulated.contribution !== null
      ? Math.round((simulated.contribution - original.contribution) * 100) / 100
      : null;

  const statusChanged = original.feasibility.status !== simulated.feasibility.status;

  let explanation;
  if (changes.length === 0) {
    explanation = 'No changes from the saved order. This is the baseline.';
  } else if (difference === null) {
    explanation = 'The contribution cannot be calculated because some inputs are missing or invalid.';
  } else {
    const list = changes.map((c) => `${c.field} ${c.from} → ${c.to}`).join(', ');
    explanation =
      `Changing ${list} moves contribution from ${money(original.contribution)} to ${money(simulated.contribution)} ` +
      `(${difference >= 0 ? '+' : '-'}₹${Math.abs(difference)}). ` +
      (statusChanged
        ? `Feasibility changes from ${original.feasibility.status} to ${simulated.feasibility.status}. `
        : `Feasibility stays ${simulated.feasibility.status}. `) +
      (simulated.contribution < 0 ? 'This scenario LOSES money on every order. ' : '') +
      (simulated.feasibility.reasons[0] && simulated.feasibility.status !== 'Green' ? simulated.feasibility.reasons.join(' ') : '');
    explanation = explanation.trim();
  }

  return { order_id: order.id, changes, original, simulated, difference, status_changed: statusChanged, explanation };
}

// Saves the scenario to the order. Needs a reason. Logged in decision history.
function applyScenario(db, order, overrides, reason) {
  if (!reason || !String(reason).trim()) throw new AppError(400, 'A reason is required to apply a scenario');
  if (FINAL.includes(order.status)) throw new AppError(400, `Cannot change an order that is ${order.status}`);

  const result = simulate(db, order, overrides);
  if (result.changes.length === 0) throw new AppError(400, 'The scenario has no changes from the saved order');

  const now = new Date().toISOString();
  const costChange = {};
  result.changes.forEach((c) => {
    order[c.field] = c.to;
    if (COST_FIELDS.includes(c.field)) costChange[c.field] = { from: c.from, to: c.to };
  });
  if (Object.keys(costChange).length > 0) {
    order.cost_changes = [...(order.cost_changes || []), { at: now, changes: costChange }];
  }
  order.updated_at = now;
  logDecision(db, order, 'Scenario applied', String(reason).trim(), result.explanation);
  return result;
}

module.exports = { simulate, applyScenario };