const assert = require('assert');
const { evaluateOrder } = require('../logic/feasibility');

const order = {
  id: 'OD1', basket_inr: 400, merchant_fee_pct: 15, customer_fee_inr: 30,
  rider_cost_inr: 55, support_inr: 8, payment_inr: 5, distance_km: 2, deadline_minutes: 35,
};
const riders = [
  { id: 'R1', max_orders: 3, assigned: 2 },
  { id: 'R2', max_orders: 3, assigned: 3 },
];

// 1. Normal order is Green, R1 recommended
let r = evaluateOrder(order, riders);
assert.strictEqual(r.status, 'Green');
assert.strictEqual(r.recommended_rider, 'R1');
console.log('PASS 1: normal order = Green');

// 2. All riders full -> zero capacity, Amber, later slot proposed
const full = [{ id: 'R1', max_orders: 3, assigned: 3 }, { id: 'R2', max_orders: 3, assigned: 3 }];
r = evaluateOrder(order, full);
assert.strictEqual(r.available_capacity, 0);
assert.strictEqual(r.status, 'Amber');
assert.ok(r.later_slot_minutes > 0);
console.log('PASS 2: no capacity = Amber + later slot (profitable but not Green)');

// 3. Outside radius -> Red
r = evaluateOrder({ ...order, distance_km: 6 }, riders, { service_radius_km: 3 });
assert.strictEqual(r.status, 'Red');
assert.strictEqual(r.checks.radius.status, 'Red');
console.log('PASS 3: outside radius = Red');

// 4. Cannot meet promised time -> not on time
r = evaluateOrder({ ...order, deadline_minutes: 15 }, riders);
assert.strictEqual(r.checks.timing.status, 'Red');
assert.notStrictEqual(r.status, 'Green');
console.log('PASS 4: late order is not Green');

// 5. Rider cost 85 -> loss -> Red
r = evaluateOrder({ ...order, rider_cost_inr: 85 }, riders);
assert.strictEqual(r.status, 'Red');
assert.strictEqual(r.contribution, -8);
console.log('PASS 5: loss = Red');

// 6. Bigger radius makes a 5 km order eligible
r = evaluateOrder({ ...order, distance_km: 5 }, riders, { service_radius_km: 5 });
assert.strictEqual(r.checks.radius.status, 'Green');
console.log('PASS 6: radius 5 km accepts 5 km order');