class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const STATUSES = ['Pending', 'Assigned', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

const TRANSITIONS = {
  Pending: ['Assigned', 'Cancelled'],
  Assigned: ['Preparing', 'Cancelled'],
  Preparing: ['Out for Delivery', 'Cancelled'],
  'Out for Delivery': ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

const isNum = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));

const RULES = {
  basket_inr: { min: 1 },
  merchant_fee_pct: { min: 0, max: 100 },
  customer_fee_inr: { min: 0 },
  rider_cost_inr: { min: 0 },
  support_inr: { min: 0 },
  payment_inr: { min: 0 },
  distance_km: { min: 0 },
  deadline_minutes: { min: 1 },
};

// partial = true is for edits (only checks fields that are present)
function validateOrderInput(input, { partial = false } = {}) {
  const errors = [];

  if (!partial && (!input.id || !String(input.id).trim())) {
    errors.push('id (order reference) is required');
  }

  for (const [key, rule] of Object.entries(RULES)) {
    const value = input[key];
    const missing = value === null || value === undefined || value === '';
    if (missing) {
      if (!partial) errors.push(`${key} is required`);
      continue;
    }
    if (!isNum(value)) {
      errors.push(`${key} must be a number`);
      continue;
    }
    const n = Number(value);
    if (rule.min !== undefined && n < rule.min) errors.push(`${key} must be at least ${rule.min}`);
    if (rule.max !== undefined && n > rule.max) errors.push(`${key} must be at most ${rule.max}`);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { AppError, STATUSES, TRANSITIONS, canTransition, validateOrderInput };