const { calculateContribution } = require('./contribution');
const { totalAvailable, recommendRider } = require('./riders');

const DEFAULTS = {
  service_radius_km: 3,
  prep_minutes: 10,
  handover_minutes: 5,
  speed_kmph: 20,
  later_slot_minutes: 30,
  thin_margin_inr: 5,
};

function estimateDeliveryMinutes(order, cfg) {
  const travel = (Number(order.distance_km) / cfg.speed_kmph) * 60;
  return Math.ceil(cfg.prep_minutes + cfg.handover_minutes + travel + (Number(order.prep_delay_minutes) || 0));
}

function evaluateOrder(order, riders, config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  const reasons = [];

  // 1. Profit
  const calc = calculateContribution(order);
  let profit;
  if (!calc.valid) {
    profit = { status: 'Red', message: calc.explanation };
  } else if (calc.contribution_inr < 0) {
    profit = { status: 'Red', message: `Loss of ₹${Math.abs(calc.contribution_inr)} on this order.` };
  } else if (calc.contribution_inr < cfg.thin_margin_inr) {
    profit = { status: 'Amber', message: `Thin margin: only ₹${calc.contribution_inr}. Confirm costs.` };
  } else {
    profit = { status: 'Green', message: `Positive contribution of ₹${calc.contribution_inr}.` };
  }

  // 2. Distance / service radius
  const dist = Number(order.distance_km);
  let radius;
  if (order.distance_km === null || order.distance_km === undefined || Number.isNaN(dist) || dist < 0) {
    radius = { status: 'Red', message: 'Distance is missing or invalid.' };
  } else if (dist > cfg.service_radius_km) {
    radius = { status: 'Red', message: `${dist} km is outside the ${cfg.service_radius_km} km service radius.` };
  } else {
    radius = { status: 'Green', message: `${dist} km is within the ${cfg.service_radius_km} km radius.` };
  }

  // 3. Time vs promise
  let timing;
  let eta = null;
  if (radius.status === 'Red' && Number.isNaN(dist)) {
    timing = { status: 'Red', message: 'Cannot estimate time without distance.' };
  } else {
    eta = estimateDeliveryMinutes(order, cfg);
    const deadline = Number(order.deadline_minutes);
    if (Number.isNaN(deadline)) {
      timing = { status: 'Red', message: 'Promised time is missing.' };
    } else if (eta > deadline) {
      timing = { status: 'Red', message: `Estimated ${eta} min is later than the promised ${deadline} min.` };
    } else {
      timing = { status: 'Green', message: `Estimated ${eta} min meets the promised ${deadline} min.` };
    }
  }

  // 4. Rider capacity
  const available = totalAvailable(riders);
  const best = recommendRider(riders);
  let capacity;
  let laterSlot = null;
  if (order.rider_id) {
    capacity = { status: 'Green', message: `Already assigned to rider ${order.rider_id}.` };
  } else if (available > 0) {
    capacity = { status: 'Green', message: `${available} rider slot(s) free. Recommended: ${best.id}.` };
  } else {
    laterSlot = cfg.later_slot_minutes;
    capacity = {
      status: 'Amber',
      message: `No rider capacity (0 available). Proposed later slot: in ${laterSlot} min.`,
    };
  }

  const checks = { profit, radius, timing, capacity };
  const all = Object.values(checks);
  const overall = all.some((c) => c.status === 'Red')
    ? 'Red'
    : all.some((c) => c.status === 'Amber')
    ? 'Amber'
    : 'Green';

  all.forEach((c) => c.status !== 'Green' && reasons.push(c.message));
  if (overall === 'Green') reasons.push('All checks passed.');

  let next_action;
  if (overall === 'Green') {
    next_action = order.rider_id
      ? `Rider ${order.rider_id} is assigned. Continue to the next delivery step.`
      : `Accept and assign rider ${best.id}.`;
  }
  else if (profit.status === 'Red') next_action = 'Reject, or renegotiate fees / reduce rider cost.';
  else if (radius.status === 'Red') next_action = 'Reject, or expand the service radius.';
  else if (timing.status === 'Red') next_action = 'Reschedule to a later promise time or reject.';
  else if (capacity.status === 'Amber') next_action = `Reschedule to a later slot (in ${laterSlot} min).`;
  else next_action = 'Review and confirm the assumptions.';

  return {
    status: overall,
    contribution: calc.valid ? calc.contribution_inr : null,
    estimated_minutes: eta,
    promised_minutes: order.deadline_minutes,
    available_capacity: available,
    recommended_rider: best ? best.id : null,
    later_slot_minutes: laterSlot,
    checks,
    reasons,
    next_action,
  };
}

module.exports = { evaluateOrder, estimateDeliveryMinutes, DEFAULTS };