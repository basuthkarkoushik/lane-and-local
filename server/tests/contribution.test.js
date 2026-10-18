const assert = require('assert');
const { calculateContribution } = require('../logic/contribution');

const base = {
  basket_inr: 400,
  merchant_fee_pct: 15,
  customer_fee_inr: 30,
  rider_cost_inr: 55,
  support_inr: 8,
  payment_inr: 5,
};

// Test 1: should be 22
const r1 = calculateContribution(base);
assert.strictEqual(r1.contribution_inr, 22);
assert.strictEqual(r1.is_loss, false);
console.log('PASS 1: contribution = 22');

// Test 2: rider cost 85 -> -8, flagged as loss
const r2 = calculateContribution({ ...base, rider_cost_inr: 85 });
assert.strictEqual(r2.contribution_inr, -8);
assert.strictEqual(r2.is_loss, true);
console.log('PASS 2: contribution = -8, loss flagged');

// Test 3: null is unknown, not zero
const r3 = calculateContribution({ ...base, rider_cost_inr: null });
assert.strictEqual(r3.valid, false);
console.log('PASS 3: null treated as unknown');

// Test 4: bad input rejected
const r4 = calculateContribution({ ...base, merchant_fee_pct: 150 });
assert.strictEqual(r4.valid, false);
console.log('PASS 4: invalid % rejected');