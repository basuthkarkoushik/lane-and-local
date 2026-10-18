const assert = require('assert');
const { syncAlerts, TYPES } = require('../logic/alerts');
const { simulate, applyScenario } = require('../logic/simulator');
const { compareRadii } = require('../logic/radius');
const { assignRider, cancelOrder } = require('../logic/orders');
const { evaluateOrder } = require('../logic/feasibility');

function makeDb() {
  const base = {
    basket_inr: 400, merchant_fee_pct: 15, customer_fee_inr: 30, rider_cost_inr: 55,
    support_inr: 8, payment_inr: 5, distance_km: 2, deadline_minutes: 35, status: 'Pending', rider_id: null,
  };
  return {
    orders: [1, 2, 3].map((n) => ({ id: `OD${n}`, ...base })),
    riders: [{ id: 'R1', max_orders: 3, assigned: 2 }, { id: 'R2', max_orders: 3, assigned: 3 }],
    alerts: [], decisions: [], config: { service_radius_km: 3 },
  };
}
const find = (db, type, id, incl = false) =>
  db.alerts.filter((a) => a.type === type && a.order_id === id && (incl || a.status !== 'Resolved'));

// 1. Healthy data = no alerts
const db = makeDb();
syncAlerts(db);
assert.strictEqual(db.alerts.length, 0);
console.log('PASS 1: healthy orders raise no alerts');

// 2. Cost change -> loss alert (Critical) + cost-change alert
db.orders[0].rider_cost_inr = 85;
db.orders[0].cost_changes = [{ at: 'now', changes: { rider_cost_inr: { from: 55, to: 85 } } }];
syncAlerts(db);
const loss = find(db, TYPES.LOSS, 'OD1');
assert.strictEqual(loss.length, 1);
assert.strictEqual(loss[0].severity, 'Critical');
assert.strictEqual(loss[0].values.contribution_inr, -8);
assert.strictEqual(find(db, TYPES.COST_CHANGE, 'OD1').length, 1);
console.log('PASS 2: rider cost 85 -> loss alert (-8) + cost-change alert');

// 3. No duplicates
syncAlerts(db); syncAlerts(db);
assert.strictEqual(find(db, TYPES.LOSS, 'OD1', true).length, 1);
console.log('PASS 3: duplicate alerts prevented');

// 4. Fix the cost -> auto-resolved, still traceable
db.orders[0].rider_cost_inr = 55;
syncAlerts(db);
const done = find(db, TYPES.LOSS, 'OD1', true);
assert.strictEqual(done.length, 1);
assert.strictEqual(done[0].status, 'Resolved');
assert.strictEqual(done[0].resolved_by, 'system');
assert.ok(done[0].resolution);
console.log('PASS 4: alert auto-resolved and kept for traceability');

// 5. Problem comes back -> new alert
db.orders[0].rider_cost_inr = 85;
syncAlerts(db);
assert.strictEqual(find(db, TYPES.LOSS, 'OD1', true).length, 2);
assert.strictEqual(find(db, TYPES.LOSS, 'OD1').length, 1);
console.log('PASS 5: recurring problem creates a fresh alert');

// 6. Manual resolve is respected until the problem clears and returns
const mine = find(db, TYPES.LOSS, 'OD1')[0];
mine.status = 'Resolved'; mine.resolved_by = 'user'; mine.resolution = 'Accepted for goodwill'; mine.condition_cleared = false;
syncAlerts(db);
assert.strictEqual(find(db, TYPES.LOSS, 'OD1').length, 0);
db.orders[0].rider_cost_inr = 55; syncAlerts(db);
assert.strictEqual(mine.condition_cleared, true);
db.orders[0].rider_cost_inr = 85; syncAlerts(db);
assert.strictEqual(find(db, TYPES.LOSS, 'OD1').length, 1);
console.log('PASS 6: manual resolution respected, new alert after recurrence');

// 7. Late order + preparation delay
const d = makeDb();
d.orders[0].prep_delay_minutes = 20;
syncAlerts(d);
assert.strictEqual(find(d, TYPES.PREP_DELAY, 'OD1').length, 1);
const late = find(d, TYPES.LATE, 'OD1');
assert.strictEqual(late.length, 1);
assert.strictEqual(late[0].values.late_by_minutes, 6);
assert.strictEqual(evaluateOrder(d.orders[0], d.riders, d.config).checks.timing.status, 'Red');
d.orders[0].prep_delay_minutes = 0; syncAlerts(d);
assert.strictEqual(find(d, TYPES.PREP_DELAY, 'OD1').length + find(d, TYPES.LATE, 'OD1').length, 0);
console.log('PASS 7: prep delay -> late alert, clears when fixed');

// 8. Outside service radius
const o = makeDb();
o.orders[0].distance_km = 6;
syncAlerts(o);
assert.strictEqual(find(o, TYPES.OUTSIDE_RADIUS, 'OD1').length, 1);
console.log('PASS 8: order outside radius flagged');

// 9. No capacity
const c = makeDb();
c.riders.forEach((r) => (r.assigned = r.max_orders));
syncAlerts(c);
['OD1', 'OD2', 'OD3'].forEach((id) => assert.strictEqual(find(c, TYPES.NO_RIDER, id).length, 1));
c.riders[0].assigned = 2; syncAlerts(c);
['OD1', 'OD2', 'OD3'].forEach((id) => assert.strictEqual(find(c, TYPES.NO_RIDER, id).length, 0));
console.log('PASS 9: no-rider alerts raised and cleared');

// 10. Cancellation
const x = makeDb();
assignRider(x, 'OD1', 'R1');
cancelOrder(x, 'OD1', 'Customer cancelled');
syncAlerts(x);
assert.strictEqual(x.orders[0].status, 'Cancelled');
assert.strictEqual(x.riders[0].assigned, 2);
assert.strictEqual(find(x, TYPES.CANCELLATION, 'OD1')[0].severity, 'Warning');
console.log('PASS 10: cancellation frees rider and raises alert');

// 11. What-If Simulator
const s = makeDb();
const r = simulate(s, s.orders[0], { rider_cost_inr: 85 });
assert.strictEqual(r.original.contribution, 22);
assert.strictEqual(r.simulated.contribution, -8);
assert.strictEqual(r.difference, -30);
assert.strictEqual(r.original.feasibility.status, 'Green');
assert.strictEqual(r.simulated.feasibility.status, 'Red');
assert.strictEqual(s.orders[0].rider_cost_inr, 55); // saved order untouched
const base = simulate(s, s.orders[0], {});
assert.strictEqual(base.difference, 0);
assert.strictEqual(base.changes.length, 0);
assert.throws(() => applyScenario(s, s.orders[0], { rider_cost_inr: 85 }, ''), (e) => e.status === 400);
applyScenario(s, s.orders[0], { rider_cost_inr: 85 }, 'Fuel price rise');
assert.strictEqual(s.orders[0].rider_cost_inr, 85);
assert.ok(s.decisions.some((x2) => x2.decision === 'Scenario applied'));
console.log('PASS 11: simulator 22 -> -8, reset works, apply needs reason');

// 12. Service radius comparison
const q = makeDb();
const cmp = compareRadii(q, [1, 2, 5], 3, 5);
const row = (km) => cmp.rows.find((z) => z.radius_km === km);
assert.strictEqual(row(1).eligible_orders, 0);
assert.strictEqual(row(1).outside_orders, 3);
assert.strictEqual(row(2).eligible_orders, 3);
assert.strictEqual(row(2).total_contribution, 66);
assert.strictEqual(row(2).avg_contribution, 22);
assert.strictEqual(row(2).waiting_for_capacity, 2);
assert.strictEqual(row(5).edge_eta_minutes, 30);
assert.strictEqual(cmp.current.radius_km, 3);
assert.strictEqual(cmp.proposed.radius_km, 5);
assert.strictEqual(typeof cmp.explanation, 'string');
console.log('PASS 12: radius comparison changes with radius');