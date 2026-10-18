const assert = require('assert');
const { isAllowed } = require('../middleware/access');
const c = require('../logic/customer');
const { decideOrder, assignRider } = require('../logic/orders');
const { syncAlerts, TYPES } = require('../logic/alerts');
const actor = require('../logic/actor');

function makeDb() {
  return {
    orders: [],
    riders: [{ id: 'R1', max_orders: 3, assigned: 0 }, { id: 'R2', max_orders: 3, assigned: 3 }],
    alerts: [], decisions: [], config: { service_radius_km: 3 },
  };
}

// 1. Owner can do everything
['GET /api/analytics', 'PUT /api/settings', 'POST /api/radius/apply', 'POST /api/simulator/apply', 'POST /api/riders']
  .forEach((x) => { const [m, p] = x.split(' '); assert.ok(isAllowed('owner', m, p), x); });
console.log('PASS 1: owner has full access');

// 2. Dispatcher takes decisions but cannot change business settings
['GET /api/orders', 'POST /api/orders/OD1/decision', 'POST /api/orders/OD1/assign', 'POST /api/orders/OD1/status',
 'POST /api/orders/OD1/cancel', 'POST /api/alerts/5/resolve', 'GET /api/riders', 'POST /api/simulator/simulate']
  .forEach((x) => { const [m, p] = x.split(' '); assert.ok(isAllowed('dispatcher', m, p), x); });
['GET /api/analytics', 'PUT /api/settings', 'POST /api/settings/reset', 'POST /api/radius/apply',
 'POST /api/simulator/apply', 'POST /api/riders', 'PUT /api/riders/R1', 'GET /api/export/orders/extra']
  .forEach((x) => { const [m, p] = x.split(' '); assert.ok(!isAllowed('dispatcher', m, p), x); });
console.log('PASS 2: dispatcher can decide but not change settings, radius or fleet');

// 3. Customer can only use the customer API
assert.ok(isAllowed('customer', 'POST', '/api/customer/orders'));
assert.ok(isAllowed('customer', 'GET', '/api/customer/orders/OD11?x=1'));
['GET /api/orders', 'GET /api/orders/OD1', 'POST /api/orders/OD1/decision', 'GET /api/alerts', 'GET /api/analytics', 'GET /api/history']
  .forEach((x) => { const [m, p] = x.split(' '); assert.ok(!isAllowed('customer', m, p), x); });
assert.ok(!isAllowed('dispatcher', 'GET', '/api/customer/orders'));
assert.ok(!isAllowed('hacker', 'GET', '/api/orders'));
console.log('PASS 3: customer is limited to /api/customer, unknown roles are blocked');

// 3b. Rider accounts can access only their own assigned-order actions.
assert.ok(isAllowed('owner', 'POST', '/api/auth/riders'));
assert.ok(isAllowed('owner', 'GET', '/api/auth/riders'));
assert.ok(isAllowed('rider', 'GET', '/api/rider/orders'));
assert.ok(isAllowed('rider', 'POST', '/api/rider/orders/OD1/respond'));
['GET /api/orders', 'GET /api/riders', 'GET /api/alerts', 'POST /api/orders/OD1/assign', 'GET /api/rider/orders/OD1']
  .forEach((x) => { const [m, p] = x.split(' '); assert.ok(!isAllowed('rider', m, p), x); });
assert.ok(!isAllowed('dispatcher', 'POST', '/api/auth/riders'));
console.log('PASS 3b: rider access is restricted to assigned delivery responses; only owners manage rider accounts');

// 4. Customer places an order; view never leaks costs or margin
const db = makeDb();
const order = c.createCustomerOrder(db, 'Asha', { basket_inr: 400, distance_km: 2 });
assert.strictEqual(order.id, 'OD1');
assert.strictEqual(order.status, 'Pending');
assert.strictEqual(order.customer, 'Asha');
const view = c.customerView(order, db);
const text = JSON.stringify(view);
['rider_cost', 'support_inr', 'payment_inr', 'merchant_fee', 'contribution', 'feasibility', 'rider_id'].forEach((k) => assert.ok(!text.includes(k), `leaked ${k}`));
assert.strictEqual(view.delivery_fee_inr, 30);
assert.strictEqual(view.total_inr, 430);
assert.strictEqual(view.rider_assigned, false);
console.log('PASS 4: customer order is created and the customer view hides internal costs');

// 5. Customers only see their own orders
c.createCustomerOrder(db, 'Ben', { basket_inr: 250, distance_km: 1 });
assert.strictEqual(c.listOwned(db, 'asha').length, 1);
assert.throws(() => c.findOwned(db, 'OD2', 'Asha'), /not found/);
assert.throws(() => c.createCustomerOrder(db, '', { basket_inr: 100, distance_km: 1 }), /name/);
assert.throws(() => c.createCustomerOrder(db, 'Asha', { basket_inr: -5, distance_km: 1 }));
console.log('PASS 5: a customer cannot open someone else\'s order, bad input is rejected');

// 6. Estimate: inside vs outside the radius
const near = c.estimate(db, { basket_inr: 400, distance_km: 2 });
assert.ok(near.valid && near.within_area && near.delivery_fee_inr === 30);
const far = c.estimate(db, { basket_inr: 400, distance_km: 6 });
assert.ok(far.valid && !far.within_area && /outside/.test(far.message));
assert.ok(!c.estimate(db, { basket_inr: 0, distance_km: 2 }).valid);
console.log('PASS 6: estimate shows fee, time and warns when outside the delivery area');

// 7. Dispatcher decisions are logged with the role; customer cancel frees rider + raises an alert
actor.set('dispatcher');
decideOrder(db, 'OD1', 'Accept', 'Rider free');
assert.strictEqual(db.orders[0].status, 'Assigned');
assert.strictEqual(db.riders[0].assigned, 1);
assert.strictEqual(db.decisions[db.decisions.length - 1].by, 'dispatcher');
actor.set('customer');
c.subscribePremium(db, 'Asha'); // Plus members may cancel after assignment, before food preparation.
c.cancelByCustomer(db, 'OD1', 'Asha', 'Changed my mind');
assert.strictEqual(db.orders[0].status, 'Cancelled');
assert.strictEqual(db.orders[0].cancelled_by, 'customer');
assert.strictEqual(db.riders[0].assigned, 0);
assert.strictEqual(db.decisions[db.decisions.length - 1].by, 'customer');
syncAlerts(db);
assert.ok(db.alerts.some((a) => a.type === TYPES.CANCELLATION && a.order_id === 'OD1'));
console.log('PASS 7: decisions record who made them; Plus customer cancel frees the rider and alerts staff');

// 8. Customer cannot cancel once out for delivery, or cancel twice
const o3 = c.createCustomerOrder(db, 'Asha', { basket_inr: 300, distance_km: 1 });
assignRider(db, o3.id, 'R1', 'test');
o3.status = 'Out for Delivery';
assert.throws(() => c.cancelByCustomer(db, o3.id, 'Asha'), /out for delivery/);
assert.throws(() => c.cancelByCustomer(db, 'OD1', 'Asha'), /already/);
console.log('PASS 8: late or repeated customer cancellations are blocked');
actor.set('system');