const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const port = 6000 + Math.floor(Math.random() * 300);
const dbFile = path.join(os.tmpdir(), `lane-local-refund-${Date.now()}.json`);
const child = spawn(process.execPath, ['index.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(port), NDD_DB_PATH: dbFile }, stdio: ['ignore', 'pipe', 'pipe'] });
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
    const owner = (await request('/auth/login', { method: 'POST', body: { email: 'owner.greentable@lane.local', password: 'LaneDemo123!' }, expected: 200 })).data;
    const customer = (await request('/auth/register', { method: 'POST', body: { name: 'Refund Tester', email: `refund-${Date.now()}@example.com`, password: 'CustomerPass123!', role: 'customer' }, expected: 201 })).data;
    const restaurant = (await request('/customer/restaurants', { expected: 200 })).data.find((r) => r.id === 'rest-green-table');
    const item = restaurant.menu[0];
    const placed = (await request('/customer/orders', { method: 'POST', token: customer.access_token, body: {
      restaurant_id: restaurant.id, items: [{ item_id: item.id, quantity: 1 }], distance_km: 2, deadline_minutes: 35,
      delivery_address: '12 Garden Street, Hyderabad', phone: '9876543210', payment_method: 'cod',
    }, expected: 201 })).data;

    const before = (await request('/analytics', { token: owner.access_token, expected: 200 })).data;
    assert.ok('flagged_orders' in before && 'pct' in before.flagged_orders, 'analytics includes flagged orders percentage');
    const refundValue = 20;
    const saved = await request(`/orders/${placed.id}/refund`, { method: 'POST', token: owner.access_token, body: { refund_inr: refundValue, reason: 'Partial refund for delayed handover' }, expected: 200 });
    assert.strictEqual(saved.data.refund_inr, refundValue);
    const after = (await request('/analytics', { token: owner.access_token, expected: 200 })).data;
    assert.strictEqual(after.refunds.available, true);
    assert.ok(after.refunds.contribution_after_refunds_per_order !== undefined);
    const chartRow = after.contribution_by_order.find((x) => x.order === placed.id);
    assert.ok(chartRow, 'order appears in contribution chart');
    assert.strictEqual(chartRow.contribution, Math.round((saved.data.contribution.contribution_inr - refundValue) * 100) / 100);
    console.log('PASS analytics: flagged order percentage is included');
    console.log('PASS refunds: owner can record a refund and analytics/chart values update');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    child.kill('SIGTERM'); await delay(100);
    try { if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile); } catch {}
  }
})();
