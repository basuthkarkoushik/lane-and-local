const { validateOrderInput, AppError } = require('./validation');
const { evaluateOrder, DEFAULTS } = require('./feasibility');
const { findOrder, cancelOrder, logDecision } = require('./orders');
const catalog = require('./catalog');

// Starting commercial terms for orders placed by customers (values from the fixture).
const QUOTE_TERMS = {
  merchant_fee_pct: 15,
  customer_fee_inr: 30,
  rider_cost_inr: 55,
  support_inr: 8,
  payment_inr: 5,
};
const DEFAULT_PROMISE_MIN = 35;
const PREMIUM_PRICE_INR = 99;
const PREMIUM_PLAN = 'Lane & Local Plus';

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

function cleanName(name) {
  const n = String(name || '').trim();
  if (n.length < 2 || n.length > 40) throw new AppError(400, 'Please enter your name (2 to 40 characters).');
  return n;
}

function ensureMemberships(db) {
  if (!Array.isArray(db.premium_memberships)) db.premium_memberships = [];
}

function membershipFor(db, name, userId = null) {
  ensureMemberships(db);
  const n = cleanName(name);
  const now = Date.now();
  return db.premium_memberships
    .filter((m) => (userId ? m.user_id === userId : (!m.user_id && same(m.customer, n))) && m.status === 'Active' && (!m.renews_at || new Date(m.renews_at).getTime() > now))
    .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0] || null;
}

function membershipView(db, name, userId = null) {
  const customer = cleanName(name);
  ensureMemberships(db);
  const active = membershipFor(db, customer, userId);
  const latest = db.premium_memberships
    .filter((m) => userId ? m.user_id === userId : (!m.user_id && same(m.customer, customer)))
    .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0] || null;
  return {
    customer,
    is_premium: Boolean(active),
    plan_name: PREMIUM_PLAN,
    price_inr_per_month: PREMIUM_PRICE_INR,
    status: active ? 'Active' : (latest?.status === 'Active' && latest.renews_at && new Date(latest.renews_at).getTime() <= Date.now() ? 'Expired' : (latest?.status || 'Not subscribed')),
    started_at: active?.started_at || latest?.started_at || null,
    renews_at: active?.renews_at || latest?.renews_at || null,
    payment_note: active?.payment_note || latest?.payment_note || null,
    benefits: [
      'Cancel an accepted order any time before food preparation begins.',
      'A clear order tracker showing when preparation begins.',
      'A visible membership status and cancellation policy on your order page.',
    ],
  };
}

function subscribePremium(db, name, userId = null) {
  const customer = cleanName(name);
  ensureMemberships(db);
  const existing = membershipFor(db, customer, userId);
  if (existing) return membershipView(db, customer, userId);

  const now = new Date();
  const renews = new Date(now);
  renews.setMonth(renews.getMonth() + 1);
  db.premium_memberships.push({
    id: `PREM-${Date.now()}`,
    customer,
    user_id: userId || null,
    plan_name: PREMIUM_PLAN,
    price_inr: PREMIUM_PRICE_INR,
    billing_period: 'monthly',
    status: 'Active',
    started_at: now.toISOString(),
    renews_at: renews.toISOString(),
    payment_note: 'Demo activation only — no real payment was collected.',
  });
  return membershipView(db, customer, userId);
}

function cancelPremium(db, name, userId = null) {
  const customer = cleanName(name);
  ensureMemberships(db);
  const active = membershipFor(db, customer, userId);
  if (!active) throw new AppError(400, 'There is no active Lane & Local Plus subscription to cancel.');
  active.status = 'Cancelled';
  active.cancelled_at = new Date().toISOString();
  active.payment_note = 'Demo subscription cancelled — no real payment was collected.';
  return membershipView(db, customer, userId);
}

function nextOrderId(db) {
  const allOrders = db._allOrderIds ? db._allOrderIds.map((id) => ({ id })) : db.orders;
  const max = allOrders.reduce((m, o) => {
    const n = /^OD(\d+)$/i.exec(o.id);
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `OD${max + 1}`;
}

function cleanItems(raw, db) {
  if (raw.items === undefined) return null; // backwards-compatible legacy request
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    throw new AppError(400, 'Add at least one menu item before placing your order.');
  }
  if (!raw.restaurant_id || !catalog.findRestaurant(raw.restaurant_id, db)) {
    throw new AppError(400, 'Choose a valid restaurant.');
  }

  const items = raw.items.map((input) => {
    const item = catalog.findMenuItem(raw.restaurant_id, input.item_id, db);
    if (!item) throw new AppError(400, 'One of the selected menu items is not available at this restaurant.');
    const qty = Number(input.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      throw new AppError(400, `Quantity for ${item.name} must be between 1 and 20.`);
    }
    return {
      item_id: item.id,
      name: item.name,
      quantity: qty,
      unit_price_inr: item.price_inr,
      subtotal_inr: item.price_inr * qty,
    };
  });

  const uniqueIds = new Set(items.map((item) => item.item_id));
  if (uniqueIds.size !== items.length) {
    throw new AppError(400, 'Each menu item should appear once with its quantity.');
  }
  return items;
}

function buildInput(raw, basketOverride) {
  const promise = raw.deadline_minutes === undefined || raw.deadline_minutes === '' ? DEFAULT_PROMISE_MIN : raw.deadline_minutes;
  return {
    basket_inr: Number(basketOverride ?? raw.basket_inr),
    distance_km: Number(raw.distance_km),
    deadline_minutes: Number(promise),
    ...QUOTE_TERMS,
  };
}

function cleanCheckoutDetails(raw, { requireDetails = false } = {}) {
  const details = {};
  if (requireDetails || raw.delivery_address) {
    const address = String(raw.delivery_address || '').trim();
    if (address.length < 8 || address.length > 240) {
      throw new AppError(400, 'Enter a delivery address between 8 and 240 characters.');
    }
    details.delivery_address = address;
  }
  if (requireDetails || raw.phone) {
    const phone = String(raw.phone || '').replace(/\D/g, '');
    const localPhone = phone.length === 12 && phone.startsWith('91') ? phone.slice(2) : phone;
    if (!/^\d{10}$/.test(localPhone)) throw new AppError(400, 'Enter a valid 10-digit mobile number.');
    details.phone = localPhone;
  }

  const method = String(raw.payment_method || 'cod');
  if (!['demo_upi', 'demo_card', 'cod'].includes(method)) {
    throw new AppError(400, 'Choose a valid payment method.');
  }
  details.payment_method = method;
  details.payment_status = method === 'cod' ? 'Pay on delivery' : 'Demo payment successful';
  details.payment_note = method === 'cod'
    ? 'Payment is due on delivery.'
    : 'Simulated payment only — no real payment was processed.';
  if (method !== 'cod') details.payment_reference = `DEMO-${Date.now()}`;
  return details;
}

// What a customer is told before ordering. Internal costs and margins are never returned.
function estimate(db, raw) {
  const input = buildInput(raw);
  const check = validateOrderInput({ id: 'PREVIEW', ...input });
  if (!check.valid) return { valid: false, errors: check.errors };
  const f = evaluateOrder({ ...input, id: 'PREVIEW', status: 'Pending', rider_id: null }, db.riders, db.config);
  const within = f.checks.radius.status === 'Green';
  const cfg = { ...DEFAULTS, ...db.config };
  return {
    valid: true,
    basket_inr: input.basket_inr,
    delivery_fee_inr: input.customer_fee_inr,
    total_inr: input.basket_inr + input.customer_fee_inr,
    estimated_minutes: f.estimated_minutes,
    promised_minutes: input.deadline_minutes,
    within_area: within,
    can_meet_time: f.checks.timing.status === 'Green',
    message: !within
      ? `This address is outside our ${cfg.service_radius_km} km delivery area. You can still send the request, but it may be declined.`
      : f.checks.timing.status !== 'Green'
      ? `We estimate about ${f.estimated_minutes} min, which is longer than the ${input.deadline_minutes} min you asked for. The restaurant may offer a later slot.`
      : `Estimated delivery in about ${f.estimated_minutes} min.`,
  };
}

function createCustomerOrder(db, name, raw, context = {}) {
  const customer = cleanName(name);
  const items = cleanItems(raw, db);
  const basket = items ? items.reduce((sum, item) => sum + item.subtotal_inr, 0) : undefined;
  const input = buildInput(raw, basket);
  const id = nextOrderId(db);
  const check = validateOrderInput({ id, ...input });
  if (!check.valid) throw new AppError(400, check.errors.join('; '));
  const details = cleanCheckoutDetails(raw, { requireDetails: Boolean(items) });
  const membership = membershipFor(db, customer, context.userId || null);
  const restaurant = items ? catalog.findRestaurant(raw.restaurant_id, db) : null;
  const now = new Date().toISOString();

  const order = {
    id,
    customer,
    ...input,
    status: 'Pending',
    rider_id: null,
    source: 'customer',
    customer_user_id: context.userId || null,
    restaurant_id: restaurant?.id || context.restaurantId || null,
    created_at: now,
    updated_at: now,
    ...details,
    restaurant_name: restaurant?.name || String(raw.restaurant_name || ''),
    items: items || [],
    premium_at_order: Boolean(membership),
    premium_plan: membership ? PREMIUM_PLAN : null,
  };
  db.orders.push(order);
  logDecision(db, order, 'Quote created', 'Placed by customer', `Delivery request from ${customer}. Awaiting dispatcher decision.`);
  return order;
}

// A customer can only open their own orders (matched by the name they signed in with).
function findOwned(db, id, name, userId = null) {
  const order = findOrder(db, id);
  const permitted = userId ? order.customer_user_id === userId : (!order.customer_user_id && same(order.customer, cleanName(name)));
  if (!permitted) throw new AppError(404, `Order ${id} not found`);
  return order;
}

function listOwned(db, name, userId = null) {
  const n = userId ? null : cleanName(name);
  return db.orders.filter((o) => userId ? o.customer_user_id === userId : (!o.customer_user_id && same(o.customer, n))).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function cancelByCustomer(db, id, name, reason, userId = null) {
  const customer = cleanName(name);
  const order = findOwned(db, id, customer, userId);
  if (order.status === 'Out for Delivery') {
    throw new AppError(400, 'Your order is already out for delivery and cannot be cancelled online. Please contact the restaurant.');
  }
  if (order.status === 'Preparing') {
    throw new AppError(400, 'Food preparation has started, so this order can no longer be cancelled online.');
  }
  const membership = membershipFor(db, customer, userId);
  const allowed = membership ? ['Pending', 'Assigned'] : ['Pending'];
  if (!allowed.includes(order.status)) {
    if (order.status === 'Assigned' && !membership) {
      throw new AppError(403, 'This order has been accepted. Lane & Local Plus lets you cancel an accepted order until food preparation begins.');
    }
    throw new AppError(400, `This order is already ${order.status}.`);
  }
  const why = String(reason || '').trim();
  cancelOrder(db, id, `Cancelled by customer${why ? `: ${why}` : ''}`);
  order.cancelled_by = 'customer';
  order.refund_status = order.payment_method === 'cod'
    ? 'Not applicable — pay on delivery'
    : 'No real payment was collected in demo mode';
  return order;
}

const MESSAGES = {
  Pending: ['Request received', 'The restaurant is checking the order and rider availability.'],
  Assigned: ['A rider has been assigned', 'Your order has been accepted and a rider is lined up.'],
  Preparing: ['Freshly preparing your order', 'The restaurant is preparing your food.'],
  'Out for Delivery': ['On the way to you', 'Your rider is on the way.'],
  Delivered: ['Delivered with care', 'Your order has arrived. Enjoy!'],
};

// The only order shape a customer receives. Internal costs, margins and feasibility are omitted.
function customerView(order, db) {
  const f = evaluateOrder(order, db.riders, db.config);
  const open = !['Delivered', 'Cancelled'].includes(order.status);
  let [headline, detail] = MESSAGES[order.status] || ['Order update', ''];
  if (order.status === 'Cancelled') {
    if (order.rejected) [headline, detail] = ['The restaurant could not accept this order', 'No payment was taken by Lane & Local in this demo.'];
    else [headline, detail] = ['Order cancelled', 'This order was cancelled.'];
  }
  const rescheduled = order.original_deadline_minutes !== undefined && order.original_deadline_minutes !== order.deadline_minutes;
  if (rescheduled && open) detail += ` Your delivery was moved to a later slot (about ${order.deadline_minutes} min).`;
  const delay = Number(order.prep_delay_minutes) || 0;
  let onTime = null;
  if (order.status === 'Delivered' && order.actual_minutes !== undefined && order.actual_minutes !== null) {
    onTime = Number(order.actual_minutes) <= Number(order.deadline_minutes);
  }
  const membership = membershipFor(db, order.customer, order.customer_user_id || null);
  const premiumCanCancel = Boolean(membership) && ['Pending', 'Assigned'].includes(order.status);
  const standardCanCancel = !membership && order.status === 'Pending';
  const publicItems = Array.isArray(order.items) ? order.items.map((item) => ({
    item_id: item.item_id,
    name: item.name,
    quantity: item.quantity,
    unit_price_inr: item.unit_price_inr,
    subtotal_inr: item.subtotal_inr,
  })) : [];

  return {
    id: order.id,
    customer: order.customer,
    restaurant_id: order.restaurant_id || null,
    restaurant_name: order.restaurant_name || null,
    items: publicItems,
    delivery_address: order.delivery_address || null,
    phone: order.phone || null,
    status: order.status,
    headline,
    detail,
    basket_inr: order.basket_inr,
    delivery_fee_inr: order.customer_fee_inr,
    total_inr: Number(order.basket_inr) + Number(order.customer_fee_inr),
    distance_km: order.distance_km,
    promised_minutes: order.deadline_minutes,
    original_promised_minutes: rescheduled ? order.original_deadline_minutes : null,
    estimated_minutes: open ? f.estimated_minutes : null,
    delay_minutes: open ? delay : 0,
    running_late: open && f.estimated_minutes !== null && f.estimated_minutes > Number(order.deadline_minutes),
    rider_assigned: Boolean(order.rider_id),
    actual_minutes: order.actual_minutes ?? null,
    on_time: onTime,
    can_cancel: Boolean(premiumCanCancel || standardCanCancel),
    cancellation_policy: membership
      ? 'Lane & Local Plus: cancel before food preparation starts.'
      : 'Standard orders can be cancelled while still awaiting restaurant acceptance. Lane & Local Plus extends cancellation to the assigned stage.',
    is_premium: Boolean(membership),
    payment_method: order.payment_method || 'Not specified',
    payment_status: order.payment_status || 'Not specified',
    payment_note: order.payment_note || null,
    refund_status: order.refund_status || null,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

module.exports = {
  estimate,
  createCustomerOrder,
  findOwned,
  listOwned,
  cancelByCustomer,
  customerView,
  membershipView,
  subscribePremium,
  cancelPremium,
  membershipFor,
  QUOTE_TERMS,
  PREMIUM_PRICE_INR,
};
