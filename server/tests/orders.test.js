const assert = require('assert');
const { assignRider, cancelOrder, updateStatus, decideOrder } = require('../logic/orders');
const { validateOrderInput, canTransition } = require('../logic/validation');

function makeDb() {
  const base = {
    basket_inr: 400, merchant_fee_pct: 15, customer_fee_inr: 30, rider_cost_inr: 55,
    support_inr: 8, payment_inr: 5, distance_km: 2, deadline_minutes: 35,
    status: 'Pending', rider_id: null,
  };
  return {
    orders: [{ id: 'OD1', ...base }, { id: 'OD2', ...base }, { id: 'OD3', ...base }],
    riders: [{ id: 'R1', max_orders: 3, assigned: 2 }, { id: 'R2', max_orders: 3, assigned: 3 }],
    alerts: [], decisions: [], config: { service_radius_km: 3 },
  };
}

function expectError(fn, status) {
  try { fn(); } catch (e) { assert.strictEqual(e.status, status); return; }
  assert.fail('Expected an error but none was thrown');
}

const db = makeDb();

// 1. Assign uses capacity
assignRider(db, 'OD1', 'R1', 'Closest free rider');
assert.strictEqual(db.riders[0].assigned, 3);
assert.strictEqual(db.orders[0].status, 'Assigned');
console.log('PASS 1: assigning updates rider and order');

// 2. Full rider cannot be assigned
expectError(() => assignRider(db, 'OD2', 'R2'), 409);
console.log('PASS 2: full rider R2 rejected');

// 3. Overbooking prevented
expectError(() => assignRider(db, 'OD2', 'R1'), 409);
console.log('PASS 3: overbooking prevented');

// 4. Cancel frees rider, reason required
expectError(() => cancelOrder(db, 'OD1', ''), 400);
cancelOrder(db, 'OD1', 'Customer cancelled');
assert.strictEqual(db.riders[0].assigned, 2);
assert.strictEqual(db.orders[0].status, 'Cancelled');
console.log('PASS 4: cancel updates status and frees rider');

// 5. Invalid transitions
expectError(() => updateStatus(db, 'OD2', 'Delivered'), 400);
expectError(() => updateStatus(db, 'OD1', 'Preparing'), 400);
assert.strictEqual(canTransition('Pending', 'Delivered'), false);
console.log('PASS 5: invalid status changes blocked');

// 6. Full lifecycle frees rider on delivery
assignRider(db, 'OD2', 'R1');
updateStatus(db, 'OD2', 'Preparing');
updateStatus(db, 'OD2', 'Out for Delivery');
updateStatus(db, 'OD2', 'Delivered', 'Done', { actual_minutes: 28 });
assert.strictEqual(db.riders[0].assigned, 2);
assert.strictEqual(db.orders[1].actual_minutes, 28);
console.log('PASS 6: delivery completes and frees rider');

// 7. All riders full: Accept blocked, Reschedule proposes later slot
const db2 = makeDb();
db2.riders.forEach((r) => (r.assigned = r.max_orders));
expectError(() => decideOrder(db2, 'OD1', 'Accept', 'Try accept'), 409);
decideOrder(db2, 'OD1', 'Reschedule', 'No capacity now');
assert.strictEqual(db2.orders[0].deadline_minutes, 65);
assert.strictEqual(db2.orders[0].status, 'Pending');
console.log('PASS 7: no capacity -> later slot');

// 8. Loss-making order cannot be accepted
const db3 = makeDb();
db3.orders[0].rider_cost_inr = 85;
expectError(() => decideOrder(db3, 'OD1', 'Accept', 'Try accept'), 409);
console.log('PASS 8: loss order cannot be accepted');

// 9. Input validation
const bad = validateOrderInput({ id: '', basket_inr: -5, merchant_fee_pct: 150, distance_km: 'abc' });
assert.strictEqual(bad.valid, false);
assert.ok(bad.errors.length >= 4);
console.log('PASS 9: invalid input rejected with clear errors');

// 10. Decisions are logged with reasons
assert.ok(db.decisions.length >= 5);
assert.ok(db.decisions.some((d) => d.decision === 'Cancelled' && d.reason === 'Customer cancelled'));
console.log('PASS 10: decisions saved with reasons');