const assert = require('assert');
const customer = require('../logic/customer');
const catalog = require('../logic/catalog');
const { assignRider } = require('../logic/orders');

function makeDb() {
  return {
    orders: [],
    riders: [{ id: 'R1', max_orders: 3, assigned: 0 }, { id: 'R2', max_orders: 3, assigned: 0 }],
    alerts: [], decisions: [], premium_memberships: [], config: { service_radius_km: 3 },
  };
}

const db = makeDb();
const restaurant = catalog.RESTAURANTS[0];
const meal = restaurant.menu[0];
const drink = restaurant.menu[3];

// A customer order is computed from server-side menu prices rather than submitted prices.
const order = customer.createCustomerOrder(db, 'Asha', {
  restaurant_id: restaurant.id,
  items: [
    { item_id: meal.id, quantity: 2, unit_price_inr: 1 },
    { item_id: drink.id, quantity: 1, unit_price_inr: 1 },
  ],
  basket_inr: 1,
  distance_km: 2,
  deadline_minutes: 35,
  delivery_address: '12 Lake Road, Hitech City',
  phone: '9876543210',
  payment_method: 'demo_upi',
});
assert.strictEqual(order.basket_inr, meal.price_inr * 2 + drink.price_inr);
assert.strictEqual(order.restaurant_name, restaurant.name);
assert.strictEqual(order.items[0].unit_price_inr, meal.price_inr);
assert.strictEqual(order.payment_status, 'Demo payment successful');
assert.match(order.payment_note, /no real payment/i);

const view = customer.customerView(order, db);
assert.strictEqual(view.items.length, 2);
assert.strictEqual(view.total_inr, order.basket_inr + 30);
assert.strictEqual(view.can_cancel, true);
const safe = JSON.stringify(view).toLowerCase();
['rider_cost_inr', 'support_inr', 'payment_inr', 'merchant_fee_pct', 'contribution', 'rider_id'].forEach((key) => {
  assert.ok(!safe.includes(key), `customer response leaked ${key}`);
});
console.log('PASS customer: menu items use server prices and customer API returns safe itemised checkout data');

assert.throws(() => customer.createCustomerOrder(makeDb(), 'Asha', {
  restaurant_id: restaurant.id,
  items: [{ item_id: 'not-a-real-menu-item', quantity: 1 }],
  distance_km: 2,
  delivery_address: '12 Lake Road, Hitech City', phone: '9876543210',
}), /not available/);
console.log('PASS customer: unknown menu items are rejected');

// Standard customers can cancel while pending, but not after the restaurant accepts the order.
const standardDb = makeDb();
const standardOrder = customer.createCustomerOrder(standardDb, 'Ben', { basket_inr: 300, distance_km: 1 });
assignRider(standardDb, standardOrder.id, 'R1', 'test assignment');
assert.throws(() => customer.cancelByCustomer(standardDb, standardOrder.id, 'Ben', 'Changed plans'), /Plus extends cancellation|Plus lets you cancel/i);
console.log('PASS premium: standard customer cannot cancel after assignment');

// Plus members may cancel a still-assigned order, but never once preparation starts.
customer.subscribePremium(standardDb, 'Ben');
customer.cancelByCustomer(standardDb, standardOrder.id, 'Ben', 'Changed plans');
assert.strictEqual(standardOrder.status, 'Cancelled');
assert.strictEqual(standardDb.riders[0].assigned, 0);
console.log('PASS premium: Plus subscription extends cancellation through Assigned and releases rider capacity');

const preparingDb = makeDb();
const preparingOrder = customer.createCustomerOrder(preparingDb, 'Mira', { basket_inr: 300, distance_km: 1 });
customer.subscribePremium(preparingDb, 'Mira');
preparingOrder.status = 'Preparing';
assert.throws(() => customer.cancelByCustomer(preparingDb, preparingOrder.id, 'Mira', 'Too late'), /preparation has started/i);
console.log('PASS premium: online cancellation is blocked after food preparation starts');

const premium = customer.membershipView(standardDb, 'Ben');
assert.strictEqual(premium.is_premium, true);
customer.cancelPremium(standardDb, 'Ben');
assert.strictEqual(customer.membershipView(standardDb, 'Ben').is_premium, false);
console.log('PASS premium: membership can be cancelled and status is persisted in JSON state');
