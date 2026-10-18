const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = 5400 + Math.floor(Math.random() * 500);
const dbFile = path.join(os.tmpdir(), `lane-local-auth-${Date.now()}.json`);
const serverDir = path.join(__dirname, '..');
const child = spawn(process.execPath, ['index.js'], {
  cwd: serverDir,
  env: { ...process.env, PORT: String(port), NDD_DB_PATH: dbFile },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.on('data', (x) => { stderr += x.toString(); });
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
    for (let i = 0; i < 60; i += 1) {
      if (child.exitCode !== null) throw new Error(`API server exited early. ${stderr}`);
      try {
        const r = await fetch(`${base}/health`);
        if (r.ok) { ready = true; break; }
      } catch {}
      await delay(150);
    }
    assert.ok(ready, `API server failed to start. ${stderr}`);

    const login = await request('/auth/login', { method: 'POST', body: { email: 'owner.greentable@lane.local', password: 'LaneDemo123!' }, expected: 200 });
    const demoOwner = login.data;
    assert.strictEqual(demoOwner.user.role, 'owner');
    assert.strictEqual(demoOwner.user.restaurant_id, 'rest-green-table');
    assert.ok(demoOwner.access_token);

    const registration = await request('/auth/register', { method: 'POST', body: {
      name: 'Taylor Owner', email: `taylor-${Date.now()}@example.com`, password: 'StrongPass123!',
      role: 'owner', restaurant_name: 'Taylor Kitchen', cuisine: 'Comfort food',
    }, expected: 201 });
    const owner = registration.data;
    const restaurantId = owner.user.restaurant_id;
    assert.ok(restaurantId && restaurantId !== demoOwner.user.restaurant_id);

    const menuResp = await request('/customer/restaurants', { expected: 200 });
    const restaurant = menuResp.data.find((r) => r.id === restaurantId);
    assert.ok(restaurant && restaurant.menu.length > 0, 'registered owner restaurant appears in customer catalogue');

    const dispatcherResp = await request('/auth/dispatchers', { method: 'POST', token: owner.access_token, body: {
      name: 'Taylor Dispatcher', email: `dispatch-${Date.now()}@example.com`, password: 'DispatchPass123!',
    }, expected: 201 });
    assert.strictEqual(dispatcherResp.data.restaurant_id, restaurantId);

    const dispatcherLogin = await request('/auth/login', { method: 'POST', body: { email: dispatcherResp.data.email, password: 'DispatchPass123!' }, expected: 200 });
    assert.strictEqual(dispatcherLogin.data.user.role, 'dispatcher');
    assert.strictEqual(dispatcherLogin.data.user.restaurant_id, restaurantId);

    const customerRegistration = await request('/auth/register', { method: 'POST', body: {
      name: 'Morgan Customer', email: `customer-${Date.now()}@example.com`, password: 'CustomerPass123!', role: 'customer',
    }, expected: 201 });
    const customer = customerRegistration.data;
    const menuItem = restaurant.menu[0];
    const placed = await request('/customer/orders', { method: 'POST', token: customer.access_token, body: {
      restaurant_id: restaurantId,
      items: [{ item_id: menuItem.id, quantity: 2 }],
      distance_km: 2,
      deadline_minutes: 35,
      delivery_address: '12 Garden Street, Hyderabad',
      phone: '9876543210',
      payment_method: 'cod',
    }, expected: 201 });
    const order = placed.data;
    assert.strictEqual(order.restaurant_id, restaurantId);
    assert.strictEqual(order.customer, 'Morgan Customer');
    assert.strictEqual(order.total_inr, menuItem.price_inr * 2 + 30);

    const myOrders = await request('/customer/orders', { token: customer.access_token, expected: 200 });
    assert.ok(myOrders.data.some((x) => x.id === order.id), 'placed order appears in My Orders API');
    const track = await request(`/customer/orders/${order.id}`, { token: customer.access_token, expected: 200 });
    assert.strictEqual(track.data.id, order.id);

    const otherCustomer = await request('/auth/register', { method: 'POST', body: {
      name: 'Other Customer', email: `other-${Date.now()}@example.com`, password: 'CustomerPass123!', role: 'customer',
    }, expected: 201 });
    const forbiddenOrder = await request(`/customer/orders/${order.id}`, { token: otherCustomer.data.access_token });
    assert.strictEqual(forbiddenOrder.status, 404, 'customers cannot read another customer\'s order');

    const ownerOrders = await request('/orders', { token: owner.access_token, expected: 200 });
    assert.ok(ownerOrders.data.some((x) => x.id === order.id), 'owner sees orders for their restaurant');
    const dispatcherOrders = await request('/orders', { token: dispatcherLogin.data.access_token, expected: 200 });
    assert.ok(dispatcherOrders.data.some((x) => x.id === order.id), 'assigned dispatcher sees the same restaurant order');
    const otherOwnerOrders = await request('/orders', { token: demoOwner.access_token, expected: 200 });
    assert.ok(!otherOwnerOrders.data.some((x) => x.id === order.id), 'another owner cannot see that restaurant order');

    const riderId = `TAY-${Date.now()}`;
    await request('/riders', { method: 'POST', token: owner.access_token, body: { id: riderId, max_orders: 3 }, expected: 201 });
    const ownerRiders = await request('/riders', { token: owner.access_token, expected: 200 });
    assert.ok(ownerRiders.data.riders.some((r) => r.id === riderId), 'owner can add and list riders for their restaurant');
    const otherOwnerRiders = await request('/riders', { token: demoOwner.access_token, expected: 200 });
    assert.ok(!otherOwnerRiders.data.riders.some((r) => r.id === riderId), 'riders stay scoped to the owner restaurant');
    const dispatcherRiderAdd = await request('/riders', { method: 'POST', token: dispatcherLogin.data.access_token, body: { id: `NO-${Date.now()}`, max_orders: 2 } });
    assert.strictEqual(dispatcherRiderAdd.status, 403, 'dispatchers cannot add riders');

    const ownerDashboard = await request('/dashboard', { token: owner.access_token, expected: 200 });
    assert.ok(Object.prototype.hasOwnProperty.call(ownerDashboard.data, 'active_alert_count'), 'owner dashboard supplies overview metrics');
    await request('/alerts', { token: owner.access_token, expected: 200 });
    await request('/alerts', { token: dispatcherLogin.data.access_token, expected: 200 });

    const forbiddenSettings = await request('/settings', { token: dispatcherLogin.data.access_token, method: 'PUT', body: { service_radius_km: 20 } });
    assert.strictEqual(forbiddenSettings.status, 403, 'dispatcher cannot change owner settings');
    const noToken = await request('/orders');
    assert.strictEqual(noToken.status, 401, 'legacy role headers are not authentication');

    const state = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    assert.ok(state.users.every((u) => u.password_hash && !u.password), 'passwords are stored as hashes');
    assert.ok(state.sessions.every((s) => s.token_hash && !s.access_token), 'only session token hashes are stored');
    console.log('PASS auth: customer and owner registration, password login and session tokens');
    console.log('PASS tenancy: each owner and their dispatchers share only their own restaurant data');
    console.log('PASS customer order: placed order appears in My Orders and tracking; customer isolation holds');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    child.kill('SIGTERM');
    await delay(100);
    try { if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile); } catch {}
  }
})();
