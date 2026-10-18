const { STATUSES, canTransition, AppError } = require('./validation');
const { evaluateOrder, DEFAULTS } = require('./feasibility');
const actor = require('./actor');

const ASSUMPTION_KEYS = [
  'basket_inr', 'merchant_fee_pct', 'customer_fee_inr', 'rider_cost_inr',
  'support_inr', 'payment_inr', 'distance_km', 'deadline_minutes',
];

function findOrder(db, id) {
  const order = db.orders.find((o) => o.id === id);
  if (!order) throw new AppError(404, `Order ${id} not found`);
  return order;
}

function requireReason(reason) {
  if (!reason || !String(reason).trim()) {
    throw new AppError(400, 'A reason is required for this action');
  }
  return String(reason).trim();
}

function touch(order) {
  order.updated_at = new Date().toISOString();
}

function logDecision(db, order, decision, reason, explanation) {
  const assumptions = {};
  ASSUMPTION_KEYS.forEach((k) => (assumptions[k] = order[k]));
  const entry = {
    id: `DEC${db.decisions.length + 1}`,
    order_id: order.id,
    restaurant_id: order.restaurant_id || db._restaurantId || 'rest-green-table',
    decision,
    reason: reason || '',
    explanation: explanation || '',
    assumptions,
    by: actor.get(),
    timestamp: new Date().toISOString(),
  };
  db.decisions.push(entry);
  return entry;
}

function assignInternal(db, order, riderId) {
  if (order.status !== 'Pending') {
    throw new AppError(400, `Only Pending orders can be assigned (current status: ${order.status})`);
  }
  const rider = db.riders.find((r) => r.id === riderId);
  if (!rider) throw new AppError(404, `Rider ${riderId} not found`);
  if (rider.assigned >= rider.max_orders) {
    throw new AppError(409, `Rider ${riderId} is full (${rider.assigned}/${rider.max_orders}). Overbooking is not allowed.`);
  }
  rider.assigned += 1;
  order.rider_id = riderId;
  order.status = 'Assigned';
  order.rider_response = 'Awaiting response';
  order.rider_response_at = null;
  order.rider_response_reason = '';
  order.assigned_at = new Date().toISOString();
  touch(order);
  return rider;
}

function releaseRider(db, order) {
  if (!order.rider_id) return;
  const rider = db.riders.find((r) => r.id === order.rider_id);
  if (rider) rider.assigned = Math.max(0, rider.assigned - 1);
}

function assignRider(db, orderId, riderId, reason) {
  const order = findOrder(db, orderId);
  assignInternal(db, order, riderId);
  logDecision(db, order, 'Assigned', reason || 'Rider assigned', `Assigned rider ${riderId}.`);
  return order;
}

function cancelOrder(db, orderId, reason) {
  const order = findOrder(db, orderId);
  const why = requireReason(reason);
  if (order.status === 'Delivered' || order.status === 'Cancelled') {
    throw new AppError(400, `Cannot cancel an order that is already ${order.status}`);
  }
  releaseRider(db, order);
  order.status = 'Cancelled';
  order.cancelled_at = new Date().toISOString();
  touch(order);
  logDecision(db, order, 'Cancelled', why, order.rider_id ? `Rider ${order.rider_id} capacity released.` : 'No rider was assigned.');
  return order;
}

function updateStatus(db, orderId, newStatus, reason, extra = {}) {
  const order = findOrder(db, orderId);
  if (!STATUSES.includes(newStatus)) throw new AppError(400, `Unknown status: ${newStatus}`);
  if (newStatus === 'Assigned') throw new AppError(400, 'Use the assign-rider action to move an order to Assigned');
  if (newStatus === 'Cancelled') return cancelOrder(db, orderId, reason);
  if (!canTransition(order.status, newStatus)) {
    throw new AppError(400, `Invalid status change: ${order.status} → ${newStatus}`);
  }

  const from = order.status;
  order.status = newStatus;
  if (newStatus === 'Delivered') {
    releaseRider(db, order);
    order.delivered_at = new Date().toISOString();
    if (extra.actual_minutes !== undefined && extra.actual_minutes !== null) {
      order.actual_minutes = Number(extra.actual_minutes);
    }
  }
  touch(order);
  logDecision(db, order, `Status: ${newStatus}`, reason || '', `Changed from ${from} to ${newStatus}.`);
  return order;
}

// decision = 'Accept' | 'Reject' | 'Reschedule'
function decideOrder(db, orderId, decision, reason, riderPool = db.riders) {
  const order = findOrder(db, orderId);
  if (!['Accept', 'Reject', 'Reschedule'].includes(decision)) {
    throw new AppError(400, 'Decision must be Accept, Reject or Reschedule');
  }
  const why = requireReason(reason);
  if (order.status !== 'Pending') {
    throw new AppError(400, `Only Pending orders can be decided (current status: ${order.status})`);
  }

  const result = evaluateOrder(order, riderPool, db.config);
  const explanation = `Feasibility ${result.status}. ${result.reasons.join(' ')}`;

  if (decision === 'Accept') {
    if (result.status === 'Red') throw new AppError(409, `Cannot accept a Red order. ${result.reasons.join(' ')}`);
    if (result.available_capacity === 0) {
      throw new AppError(409, `No rider capacity. Reschedule to a later slot (+${result.later_slot_minutes} min) instead.`);
    }
    assignInternal(db, order, result.recommended_rider);
    logDecision(db, order, 'Accepted', why, `${explanation} Assigned rider ${result.recommended_rider}.`);
  }

  if (decision === 'Reject') {
    order.status = 'Cancelled';
    order.rejected = true;
    order.cancelled_at = new Date().toISOString();
    touch(order);
    logDecision(db, order, 'Rejected', why, explanation);
  }

  if (decision === 'Reschedule') {
    const slot = result.later_slot_minutes || db.config.later_slot_minutes || DEFAULTS.later_slot_minutes;
    if (order.original_deadline_minutes === undefined) order.original_deadline_minutes = order.deadline_minutes;
    order.deadline_minutes = Number(order.deadline_minutes) + slot;
    order.reschedule_count = (order.reschedule_count || 0) + 1;
    touch(order);
    logDecision(db, order, 'Rescheduled', why, `${explanation} Promise moved to ${order.deadline_minutes} min (+${slot}).`);
  }

  return order;
}

module.exports = { findOrder, assignRider, cancelOrder, updateStatus, decideOrder, logDecision };