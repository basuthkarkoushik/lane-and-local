const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = 5900 + Math.floor(Math.random() * 400);
const dbFile = path.join(os.tmpdir(), `lane-local-rider-${Date.now()}.json`);
const serverDir = path.join(__dirname, '..');
const child = spawn(process.execPath, ['index.js'], {
  cwd: serverDir,
  env: { ...process.env, PORT: String(port), NDD_DB_PATH: dbFile },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
const base = `http://127.0.0.1:${port}/api`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(route, { method = 'GET', token, body, expected } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (expected && response.status !== expected) throw new Error(`${method} ${route}: expected ${expected}, got ${response.status}; ${JSON.stringify(data)}`);
  return { status: response.status, data };
}

(async () => {
  try {
    let ready = false;
    for (let i = 0; i < 70; i += 1) {
      if (child.exitCode !== null) throw new Error(`API server exited early. ${stderr}`);
      try {
        const response = await fetch(`${base}/health`);
        if (response.ok) { ready = true; break; }
      } catch {}
      await delay(120);
    }
    assert.ok(ready, `API server failed to start. ${stderr}`);

    const suffix = Date.now();
    const owner = (await request('/auth/register', { method: 'POST', expected: 201, body: {
      name: 'Rider Test Owner', email: `rider-owner-${suffix}@example.com`, password: 'OwnerPass123!', role: 'owner', restaurant_name: 'Rider Test Kitchen', cuisine: 'Local food',
    } })).data;
    const restaurantId = owner.user.restaurant_id;
    const dispatcher = (await request('/auth/dispatchers', { method: 'POST', token: owner.access_token, expected: 201, body: {
      name: 'Test Dispatcher', email: `rider-dispatch-${suffix}@example.com`, password: 'DispatchPass123!',
    } })).data;
    const dispatcherLogin = (await request('/auth/login', { method: 'POST', expected: 200, body: { email: dispatcher.email, password: 'DispatchPass123!' } })).data;

    const rider = (await request('/auth/riders', { method: 'POST', token: owner.access_token, expected: 201, body: {
      name: 'Robin Rider', email: `rider-${suffix}@example.com`, password: 'RiderPass123!', max_orders: 3,
    } })).data;
    assert.strictEqual(rider.role, 'rider');
    assert.ok(rider.rider_id, 'new rider profile ID is returned');
    const riderLogin = (await request('/auth/login', { method: 'POST', expected: 200, body: { email: rider.email, password: 'RiderPass123!' } })).data;
    assert.strictEqual(riderLogin.user.role, 'rider');
    assert.strictEqual(riderLogin.user.rider_id, rider.rider_id);

    const customer = (await request('/auth/register', { method: 'POST', expected: 201, body: {
      name: 'Delivery Customer', email: `rider-customer-${suffix}@example.com`, password: 'CustomerPass123!', role: 'customer',
    } })).data;
    const restaurants = (await request('/customer/restaurants', { expected: 200 })).data;
    const restaurant = restaurants.find((item) => item.id === restaurantId);
    assert.ok(restaurant && restaurant.menu.length > 0, 'owner restaurant is listed with menu');

    async function placeOrder() {
      return (await request('/customer/orders', { method: 'POST', token: customer.access_token, expected: 201, body: {
        restaurant_id: restaurantId,
        items: [{ item_id: restaurant.menu[0].id, quantity: 1 }],
        distance_km: 2,
        deadline_minutes: 45,
        delivery_address: '14 Garden Street, Hyderabad, Telangana',
        phone: '9876543210',
        payment_method: 'cod',
      } })).data;
    }

    const assignedOrder = await placeOrder();
    await request(`/orders/${assignedOrder.id}/assign`, { method: 'POST', token: dispatcherLogin.access_token, expected: 200, body: { rider_id: rider.rider_id, reason: 'Rider accepted dispatch assignment request' } });
    const riderInbox = (await request('/rider/orders', { token: riderLogin.access_token, expected: 200 })).data;
    const ownOrder = riderInbox.orders.find((item) => item.id === assignedOrder.id);
    assert.ok(ownOrder, 'assigned order appears in rider inbox');
    assert.strictEqual(ownOrder.customer, 'Delivery Customer');
    assert.strictEqual(ownOrder.phone, '9876543210');
    assert.strictEqual(ownOrder.delivery_address, '14 Garden Street, Hyderabad, Telangana');
    assert.ok(Array.isArray(ownOrder.items) && ownOrder.items.length === 1, 'item details are sent to rider');
    const safePayload = JSON.stringify(ownOrder);
    ['rider_cost_inr', 'merchant_fee_pct', 'support_inr', 'contribution_inr'].forEach((key) => assert.ok(!safePayload.includes(key), `rider payload must not expose ${key}`));

    const accepted = await request(`/rider/orders/${assignedOrder.id}/respond`, { method: 'POST', token: riderLogin.access_token, expected: 200, body: { action: 'accept' } });
    assert.strictEqual(accepted.data.order.rider_response, 'Accepted');
    const forbiddenOrders = await request('/orders', { token: riderLogin.access_token });
    assert.strictEqual(forbiddenOrders.status, 403, 'rider cannot access the staff-wide orders list');

    await request(`/orders/${assignedOrder.id}/status`, { method: 'POST', token: dispatcherLogin.access_token, expected: 200, body: { status: 'Preparing', reason: 'Kitchen ready' } });
    await request(`/orders/${assignedOrder.id}/status`, { method: 'POST', token: dispatcherLogin.access_token, expected: 200, body: { status: 'Out for Delivery', reason: 'Rider picked up' } });
    await request(`/orders/${assignedOrder.id}/status`, { method: 'POST', token: dispatcherLogin.access_token, expected: 200, body: { status: 'Delivered', reason: 'Delivered', actual_minutes: 30 } });

    const rejectedOrder = await placeOrder();
    await request(`/orders/${rejectedOrder.id}/assign`, { method: 'POST', token: dispatcherLogin.access_token, expected: 200, body: { rider_id: rider.rider_id, reason: 'Second assignment' } });
    const rejected = await request(`/rider/orders/${rejectedOrder.id}/respond`, { method: 'POST', token: riderLogin.access_token, expected: 200, body: { action: 'reject', reason: 'Bike issue on this shift' } });
    assert.strictEqual(rejected.data.order.rider_response, 'Rejected');
    const backInQueue = (await request(`/orders/${rejectedOrder.id}`, { token: dispatcherLogin.access_token, expected: 200 })).data;
    assert.strictEqual(backInQueue.status, 'Pending', 'a declined assignment returns to dispatch queue');
    assert.strictEqual(backInQueue.rider_id, null, 'declined order is unassigned');

    const unassignedRiderOrders = (await request('/rider/orders', { token: riderLogin.access_token, expected: 200 })).data.orders;
    assert.ok(!unassignedRiderOrders.some((item) => item.id === rejectedOrder.id), 'rejected order is removed from rider inbox');

    const accountList = (await request('/auth/riders', { token: owner.access_token, expected: 200 })).data;
    assert.ok(accountList.riders.some((profile) => profile.id === rider.rider_id && profile.account?.email === rider.email), 'owner can list the linked rider account');

    await request(`/auth/riders/${rider.id}`, { method: 'DELETE', token: owner.access_token, expected: 200 });
    const oldSession = await request('/rider/orders', { token: riderLogin.access_token });
    assert.strictEqual(oldSession.status, 401, 'deactivating a rider revokes their existing session');

    console.log('PASS rider registration: owner creates an account linked to a capacity profile');
    console.log('PASS rider inbox: assigned customer, location, contact, item and payment details are available without internal margin data');
    console.log('PASS rider decisions: accept is recorded and reject releases capacity and returns the order to dispatch');
    console.log('PASS rider security: riders cannot read staff-wide orders; deactivation revokes active sessions');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    child.kill('SIGTERM');
    await delay(100);
    try { if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile); } catch {}
  }
})();
