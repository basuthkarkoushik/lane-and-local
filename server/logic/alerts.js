const { calculateContribution } = require('./contribution');
const { evaluateOrder, DEFAULTS } = require('./feasibility');
const { totalAvailable } = require('./riders');

const FINAL = ['Delivered', 'Cancelled'];

const TYPES = {
  LATE: 'Likely late',
  NO_RIDER: 'No eligible rider',
  LOSS: 'Negative contribution',
  PREP_DELAY: 'Restaurant preparation delay',
  CANCELLATION: 'Cancellation needs action',
  COST_CHANGE: 'Quote affected by cost change',
  OUTSIDE_RADIUS: 'Outside service radius',
};

const RESOLUTION_TEXT = {
  [TYPES.LATE]: 'The order can now meet its promised time, or it was closed.',
  [TYPES.NO_RIDER]: 'Rider capacity is available again, or the order is no longer waiting.',
  [TYPES.LOSS]: 'Contribution is no longer negative, or the order was closed.',
  [TYPES.PREP_DELAY]: 'The preparation delay was cleared, or the order moved on.',
  [TYPES.CANCELLATION]: 'No longer applicable.',
  [TYPES.COST_CHANGE]: 'The order was completed or cancelled.',
  [TYPES.OUTSIDE_RADIUS]: 'The order is now inside the service radius, or it was closed.',
};

const money = (n) => (n < 0 ? `-₹${Math.abs(n)}` : `₹${n}`);
const keyOf = (type, orderId) => `${type}|${orderId}`;

// Look at the current data and list every problem that exists right now
function detectIssues(db) {
  const issues = [];
  const cfg = { ...DEFAULTS, ...db.config };
  const free = totalAvailable(db.riders);

  db.orders.forEach((order) => {
    const calc = calculateContribution(order);
    const f = evaluateOrder(order, db.riders, db.config);
    const isOpen = !FINAL.includes(order.status);
    const deadline = Number(order.deadline_minutes);
    const add = (type, severity, reason, values, action) =>
      issues.push({ key: keyOf(type, order.id), type, severity, order_id: order.id, restaurant_id: order.restaurant_id || 'rest-green-table', reason, values, suggested_action: action });

    // 1. Negative contribution
    if (isOpen && calc.valid && calc.is_loss) {
      const last = (order.cost_changes || []).slice(-1)[0];
      const why = last ? ` after a cost change (${Object.keys(last.changes).join(', ')})` : '';
      add(
        TYPES.LOSS, 'Critical',
        `Contribution is ${money(calc.contribution_inr)}${why}: income ${money(calc.revenue_inr)} vs costs ${money(calc.costs_inr)}.`,
        { contribution_inr: calc.contribution_inr, revenue_inr: calc.revenue_inr, costs_inr: calc.costs_inr, rider_cost_inr: calc.rider_cost_inr },
        'Renegotiate fees, lower the rider cost, or reject the order.'
      );
    }

    // 2. Likely late
    if (isOpen && f.estimated_minutes !== null && Number.isFinite(deadline) && f.estimated_minutes > deadline) {
      add(
        TYPES.LATE, 'Critical',
        `Estimated ${f.estimated_minutes} min is later than the promised ${deadline} min.`,
        { estimated_minutes: f.estimated_minutes, promised_minutes: deadline, late_by_minutes: f.estimated_minutes - deadline },
        'Reschedule to a later promise time, or tell the customer about the delay.'
      );
    }

    // 3. No rider capacity
    if (order.status === 'Pending' && free === 0) {
      add(
        TYPES.NO_RIDER, 'Warning',
        'No rider has free capacity (0 available).',
        { available_capacity: 0, later_slot_minutes: f.later_slot_minutes },
        `Reschedule to a later slot (+${f.later_slot_minutes || cfg.later_slot_minutes} min) or add rider capacity.`
      );
    }

    // 4. Restaurant preparation delay
    if (['Pending', 'Assigned', 'Preparing'].includes(order.status) && Number(order.prep_delay_minutes) > 0) {
      add(
        TYPES.PREP_DELAY, 'Warning',
        `Restaurant reported a ${order.prep_delay_minutes} min preparation delay.`,
        { prep_delay_minutes: Number(order.prep_delay_minutes), estimated_minutes: f.estimated_minutes, promised_minutes: deadline },
        'Tell the customer about the delay and re-check the promised time.'
      );
    }

    // 5. Outside service radius
    const dist = Number(order.distance_km);
    if (isOpen && order.distance_km !== null && order.distance_km !== undefined && Number.isFinite(dist) && f.checks.radius.status === 'Red') {
      add(
        TYPES.OUTSIDE_RADIUS, 'Warning',
        f.checks.radius.message,
        { distance_km: dist, service_radius_km: cfg.service_radius_km },
        'Reject the order, or expand the service radius.'
      );
    }

    // 6. Quote affected by changed costs
    if (isOpen && Array.isArray(order.cost_changes) && order.cost_changes.length > 0) {
      const last = order.cost_changes[order.cost_changes.length - 1];
      const text = Object.entries(last.changes).map(([k, v]) => `${k} ${v.from} → ${v.to}`).join(', ');
      add(
        TYPES.COST_CHANGE, 'Informational',
        `Costs changed on this quote: ${text}.`,
        { changes: last.changes, contribution_inr: calc.valid ? calc.contribution_inr : null },
        'Check that the quote still makes sense and re-confirm it with the restaurant.'
      );
    }

    // 7. Cancellation needing action (rejections made by us are not included)
    if (order.status === 'Cancelled' && !order.rejected) {
      add(
        TYPES.CANCELLATION, order.rider_id ? 'Warning' : 'Informational',
        order.rider_id
          ? `Order was cancelled. Rider ${order.rider_id} capacity has been released.`
          : 'Order was cancelled before a rider was assigned.',
        { rider_id: order.rider_id || null, cancelled_at: order.cancelled_at || null },
        'Confirm any refund and tell the restaurant to stop preparing.'
      );
    }
  });

  return issues;
}

// Make the alert list match reality. Safe to call as many times as you like.
function syncAlerts(db) {
  const now = new Date().toISOString();
  const detected = new Map(detectIssues(db).map((i) => [i.key, i]));

  // Create new alerts or refresh existing ones (never a duplicate for an unresolved issue)
  detected.forEach((issue, key) => {
    const existing = db.alerts.find((a) => a.key === key && a.status !== 'Resolved');
    if (existing) {
      const before = JSON.stringify([existing.severity, existing.reason, existing.values, existing.suggested_action]);
      const after = JSON.stringify([issue.severity, issue.reason, issue.values, issue.suggested_action]);
      if (before !== after) {
        existing.severity = issue.severity;
        existing.reason = issue.reason;
        existing.values = issue.values;
        existing.suggested_action = issue.suggested_action;
        existing.updated_at = now;
      }
      return;
    }

    // You resolved it yourself while the problem still exists: don't raise it again
    const last = [...db.alerts].reverse().find((a) => a.key === key);
    if (last && last.status === 'Resolved' && last.resolved_by === 'user' && !last.condition_cleared) return;

    db.alerts.push({
      id: `ALT-${db._restaurantId || issue.restaurant_id || 'global'}-${db.alerts.length + 1}`,
      key,
      type: issue.type,
      severity: issue.severity,
      order_id: issue.order_id,
      restaurant_id: issue.restaurant_id,
      reason: issue.reason,
      values: issue.values,
      suggested_action: issue.suggested_action,
      status: 'Open',
      created_at: now,
      updated_at: now,
      acknowledged_at: null,
      resolved_at: null,
      resolved_by: null,
      resolution: null,
      condition_cleared: false,
    });
  });

  // Problem is gone: auto-resolve (kept in the list for traceability)
  db.alerts.forEach((a) => {
    if (detected.has(a.key)) return;
    if (a.status !== 'Resolved') {
      a.status = 'Resolved';
      a.resolved_at = now;
      a.updated_at = now;
      a.resolved_by = 'system';
      a.resolution = `Auto-resolved: ${RESOLUTION_TEXT[a.type] || 'the problem was corrected.'}`;
      a.condition_cleared = true;
    } else if (a.resolved_by === 'user' && !a.condition_cleared) {
      a.condition_cleared = true;
    }
  });
}

module.exports = { syncAlerts, detectIssues, TYPES };