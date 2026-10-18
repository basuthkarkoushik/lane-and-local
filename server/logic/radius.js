const { calculateContribution } = require('./contribution');
const { estimateDeliveryMinutes, DEFAULTS } = require('./feasibility');
const { riderCapacity, totalAvailable } = require('./riders');

const FINAL = ['Delivered', 'Cancelled'];
const TIGHT_MARGIN_MIN = 5; // "at risk" = estimated time is late or within 5 min of the promise

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
const money = (n) => (n < 0 ? `-₹${Math.abs(n)}` : `₹${n}`);
const hasDistance = (o) => o.distance_km !== null && o.distance_km !== undefined && o.distance_km !== '' && Number.isFinite(Number(o.distance_km));
const num = (o) => Number(o.deadline_minutes);

function evaluateRadius(db, radiusKm) {
  const cfg = { ...DEFAULTS, ...db.config };
  const open = db.orders.filter((o) => !FINAL.includes(o.status));
  const eligible = open.filter((o) => hasDistance(o) && Number(o.distance_km) <= radiusKm);
  const outside = open.filter((o) => !eligible.includes(o));

  const timed = eligible.map((o) => ({ o, eta: estimateDeliveryMinutes(o, cfg) }));
  const atRisk = timed.filter(({ o, eta }) => Number.isFinite(num(o)) && eta > num(o) - TIGHT_MARGIN_MIN);
  const late = timed.filter(({ o, eta }) => Number.isFinite(num(o)) && eta > num(o));

  const calcs = eligible.map(calculateContribution).filter((c) => c.valid);
  const total = round2(calcs.reduce((s, c) => s + c.contribution_inr, 0));

  const caps = riderCapacity(db.riders);
  const capacity = totalAvailable(db.riders);
  const pendingEligible = eligible.filter((o) => o.status === 'Pending' && !o.rider_id).length;

  // Shortest promise among open orders (or all orders if none are open)
  const pool = open.length ? open : db.orders;
  const deadlines = pool.map(num).filter(Number.isFinite);
  const promise = deadlines.length ? Math.min(...deadlines) : null;
  const edgeEta = Math.ceil(cfg.prep_minutes + cfg.handover_minutes + (radiusKm / cfg.speed_kmph) * 60);

  return {
    radius_km: radiusKm,
    eligible_orders: eligible.length,
    eligible_ids: eligible.map((o) => o.id),
    outside_orders: outside.length,
    outside_ids: outside.map((o) => o.id),
    avg_eta_minutes: timed.length ? round1(timed.reduce((s, t) => s + t.eta, 0) / timed.length) : null,
    max_eta_minutes: timed.length ? Math.max(...timed.map((t) => t.eta)) : null,
    edge_eta_minutes: edgeEta,
    promise_minutes: promise,
    edge_margin_minutes: promise === null ? null : promise - edgeEta,
    available_riders: caps.filter((r) => r.remaining > 0).length,
    available_capacity: capacity,
    waiting_for_capacity: Math.max(0, pendingEligible - capacity),
    at_risk_orders: atRisk.length,
    late_orders: late.length,
    reliable_pct: eligible.length ? Math.round(((eligible.length - atRisk.length) / eligible.length) * 100) : null,
    total_contribution: total,
    avg_contribution: calcs.length ? round2(total / calcs.length) : null,
  };
}

function explainTradeoff(cur, prop) {
  if (cur.radius_km === prop.radius_km) return 'Current and proposed radius are the same.';
  const bigger = prop.radius_km > cur.radius_km;
  const dOrders = prop.eligible_orders - cur.eligible_orders;
  const dContribution = round2(prop.total_contribution - cur.total_contribution);
  const dRisk = prop.at_risk_orders - cur.at_risk_orders;
  const lines = [];

  lines.push(
    `${bigger ? 'Expanding' : 'Reducing'} the radius from ${cur.radius_km} km to ${prop.radius_km} km changes serviceable open orders from ` +
      `${cur.eligible_orders} to ${prop.eligible_orders} (${dOrders >= 0 ? '+' : ''}${dOrders}) and expected contribution from ` +
      `${money(cur.total_contribution)} to ${money(prop.total_contribution)} (${dContribution >= 0 ? '+' : '-'}₹${Math.abs(dContribution)}).`
  );

  if (bigger && dOrders === 0) {
    lines.push('No open order in the current data sits in that extra band, so expanding adds delivery-time risk without adding orders today.');
  }

  if (prop.edge_margin_minutes !== null) {
    if (prop.edge_margin_minutes < 0) {
      lines.push(`A delivery at the edge of ${prop.radius_km} km takes about ${prop.edge_eta_minutes} min, which is ${Math.abs(prop.edge_margin_minutes)} min over the shortest promise (${prop.promise_minutes} min). Far orders would miss the promise.`);
    } else if (prop.edge_margin_minutes <= TIGHT_MARGIN_MIN) {
      lines.push(`A delivery at the edge of ${prop.radius_km} km takes about ${prop.edge_eta_minutes} min, leaving only ${prop.edge_margin_minutes} min of margin against a ${prop.promise_minutes} min promise.`);
    } else {
      lines.push(`A delivery at the edge of ${prop.radius_km} km takes about ${prop.edge_eta_minutes} min, leaving ${prop.edge_margin_minutes} min of margin against a ${prop.promise_minutes} min promise.`);
    }
  }

  lines.push(`Orders at risk of lateness: ${cur.at_risk_orders} → ${prop.at_risk_orders} (${dRisk >= 0 ? '+' : ''}${dRisk}). Orders waiting for rider capacity: ${cur.waiting_for_capacity} → ${prop.waiting_for_capacity}.`);

  lines.push(
    bigger
      ? 'Trade-off: a larger radius can bring more orders, but every far delivery takes longer, promises are easier to miss and riders stay busy for longer.'
      : 'Trade-off: a smaller radius serves fewer orders, but delivery times stay shorter and slots are more reliable.'
  );
  return lines.join(' ');
}

function compareRadii(db, radii, currentKm, proposedKm) {
  const cfg = { ...DEFAULTS, ...db.config };
  const unique = [...new Set([...radii, currentKm, proposedKm].map(Number))].sort((a, b) => a - b);
  const rows = unique.map((r) => evaluateRadius(db, r));
  const current = rows.find((r) => r.radius_km === Number(currentKm));
  const proposed = rows.find((r) => r.radius_km === Number(proposedKm));
  return {
    rows,
    current,
    proposed,
    explanation: explainTradeoff(current, proposed),
    time_model: `Estimated model (no live routing or GPS): ${cfg.prep_minutes} min preparation + ${cfg.handover_minutes} min handover + travel at ${cfg.speed_kmph} km/h.`,
  };
}

module.exports = { compareRadii, evaluateRadius };