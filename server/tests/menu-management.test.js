const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = 5700 + Math.floor(Math.random() * 300);
const dbFile = path.join(os.tmpdir(), `lane-local-menu-${Date.now()}.json`);
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
      try { if ((await fetch(`${base}/health`)).ok) { ready = true; break; } } catch {}
      await delay(150);
    }
    assert.ok(ready, `API server failed to start. ${stderr}`);

    const ownerLogin = await request('/auth/login', { method: 'POST', body: { email: 'owner.greentable@lane.local', password: 'LaneDemo123!' }, expected: 200 });
    const ownerToken = ownerLogin.data.access_token;
    const otherOwnerLogin = await request('/auth/login', { method: 'POST', body: { email: 'owner.tiffin@lane.local', password: 'LaneDemo123!' }, expected: 200 });
    const ownerMenu = await request('/menu', { token: ownerToken, expected: 200 });
    assert.ok(ownerMenu.data.items.length > 0);

    const created = await request('/menu', { method: 'POST', token: ownerToken, body: { name: 'Test Seasonal Bowl', description: 'Seasonal vegetables and grains', category: 'Bowls', price_inr: 215, emoji: '🥗', vegetarian: true }, expected: 201 });
    const id = created.data.id;
    const customerCatalogueBefore = await request('/customer/restaurants', { expected: 200 });
    const greenBefore = customerCatalogueBefore.data.find((r) => r.id === 'rest-green-table');
    assert.ok(greenBefore.menu.some((item) => item.id === id), 'available item appears in customer menu');

    await request(`/menu/${encodeURIComponent(id)}/availability`, { method: 'POST', token: ownerToken, body: { availability: 'paused' }, expected: 200 });
    const pausedMenu = await request('/menu', { token: ownerToken, expected: 200 });
    assert.strictEqual(pausedMenu.data.items.find((item) => item.id === id).availability, 'paused');
    const customerCatalogueAfter = await request('/customer/restaurants', { expected: 200 });
    const greenAfter = customerCatalogueAfter.data.find((r) => r.id === 'rest-green-table');
    assert.ok(!greenAfter.menu.some((item) => item.id === id), 'paused item is hidden from customers');

    const customerReg = await request('/auth/register', { method: 'POST', body: { name: 'Menu Tester', email: `menu-tester-${Date.now()}@example.com`, password: 'CustomerPass123!', role: 'customer' }, expected: 201 });
    const deniedOrder = await request('/customer/orders', { method: 'POST', token: customerReg.data.access_token, body: {
      restaurant_id: 'rest-green-table', items: [{ item_id: id, quantity: 1 }], distance_km: 2, deadline_minutes: 35,
      delivery_address: '12 Garden Street, Hyderabad', phone: '9876543210', payment_method: 'cod',
    } });
    assert.strictEqual(deniedOrder.status, 400, 'paused menu item cannot be ordered');

    const otherOwnerDenied = await request(`/menu/${encodeURIComponent(id)}`, { method: 'PUT', token: otherOwnerLogin.data.access_token, body: { name: 'Trying to change other menu', price_inr: 1 } });
    assert.strictEqual(otherOwnerDenied.status, 404, 'owners cannot edit another restaurant menu');

    await request(`/menu/${encodeURIComponent(id)}/availability`, { method: 'POST', token: ownerToken, body: { availability: 'available' }, expected: 200 });
    await request(`/menu/${encodeURIComponent(id)}`, { method: 'DELETE', token: ownerToken, expected: 200 });
    const afterRemove = await request('/menu', { token: ownerToken, expected: 200 });
    assert.ok(!afterRemove.data.items.some((item) => item.id === id), 'removed item is no longer in owner menu');
    console.log('PASS menu: add, pause, resume and remove items');
    console.log('PASS menu: paused items are hidden from customers and rejected at checkout');
    console.log('PASS menu: owner access is scoped to the owner restaurant');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    child.kill('SIGTERM');
    await delay(100);
    try { if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile); } catch {}
  }
})();
