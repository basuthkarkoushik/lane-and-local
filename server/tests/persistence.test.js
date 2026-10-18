// Mandatory test 11: data must still be there after the application restarts.
// Two separate Node processes are used: the first writes, the second (a "restart") reads.
const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = path.join(os.tmpdir(), `ndd-persist-${Date.now()}.json`);
const env = { ...process.env, NDD_DB_PATH: tmp }; // keeps your real db.json untouched
const root = path.join(__dirname, '..');
const run = (code) => execFileSync(process.execPath, ['-e', code], { env, cwd: root }).toString().trim();

try {
  // process 1: start from the fixture, accept an order, change a setting, save
  run(`
    const s = require('./data/store');
    const o = require('./logic/orders');
    const db = s.seed();
    o.decideOrder(db, 'OD1', 'Accept', 'persistence test');
    db.config.prep_minutes = 12;
    s.save(db);
  `);

  // process 2: a brand new process loads the saved file
  const out = JSON.parse(run(`
    const s = require('./data/store');
    const db = s.load();
    const o = db.orders.find((x) => x.id === 'OD1');
    console.log(JSON.stringify({
      status: o.status, rider: o.rider_id, assigned: db.riders.find((r) => r.id === o.rider_id).assigned,
      decisions: db.decisions.length, reason: db.decisions[0].reason, prep: db.config.prep_minutes,
    }));
  `));

  assert.strictEqual(out.status, 'Assigned');
  assert.strictEqual(out.rider, 'R1');
  assert.strictEqual(out.assigned, 3);
  assert.strictEqual(out.decisions, 1);
  assert.strictEqual(out.reason, 'persistence test');
  assert.strictEqual(out.prep, 12);
  console.log('PASS 11: orders, rider assignments, decisions and settings survive a restart');
} finally {
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
}