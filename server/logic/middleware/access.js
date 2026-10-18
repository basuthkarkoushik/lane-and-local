const actor = require('../logic/actor');

const ROLES = ['owner', 'dispatcher', 'customer'];

// What a dispatcher may call. Owner may call everything. Customer may only use /api/customer/*.
// Owner-only: rider fleet changes, settings, reset, service radius, simulator apply, analytics.
const ORDER_ACTIONS = '(assign|status|cancel|decision|prep-delay)';
const DISPATCHER = [
  ['GET', /^\/api\/dashboard$/],
  ['GET', /^\/api\/orders(\/[^/]+)?$/],
  ['POST', /^\/api\/orders$/],
  ['POST', /^\/api\/orders\/preview$/],
  ['PUT', /^\/api\/orders\/[^/]+$/],
  ['POST', new RegExp(`^/api/orders/[^/]+/${ORDER_ACTIONS}$`)],
  ['GET', /^\/api\/riders$/],
  ['GET', /^\/api\/alerts$/],
  ['POST', /^\/api\/alerts\/[^/]+\/(acknowledge|resolve)$/],
  ['GET', /^\/api\/history$/],
  ['GET', /^\/api\/settings$/],
  ['POST', /^\/api\/simulator\/simulate$/],
  ['GET', /^\/api\/export\/(orders|alerts|history)$/],
];

function cleanPath(url) {
  return (String(url).split('?')[0].replace(/\/+$/, '')) || '/';
}

function isAllowed(role, method, url) {
  if (!ROLES.includes(role)) return false;
  const path = cleanPath(url);
  if (path === '/api/health') return true;
  if (/^\/api\/customer(\/|$)/.test(path)) return role === 'customer' || role === 'owner';
  if (role === 'customer') return false;
  if (role === 'owner') return true;
  return DISPATCHER.some(([m, re]) => m === String(method).toUpperCase() && re.test(path));
}

// Prototype access control: the role is sent by the browser. It is NOT real authentication.
function access(req, res, next) {
  if (cleanPath(req.originalUrl) === '/api/health') return next();
  const role = String(req.get('x-role') || '').toLowerCase();
  let user = '';
  try { user = decodeURIComponent(req.get('x-user') || ''); } catch { user = ''; }
  req.role = role;
  req.user = user.trim();
  if (!ROLES.includes(role)) {
    return res.status(401).json({ error: 'Please choose a role (owner, dispatcher or customer) first.' });
  }
  if (!isAllowed(role, req.method, req.originalUrl)) {
    return res.status(403).json({ error: `The ${role} role is not allowed to do this.` });
  }
  actor.set(role);
  res.on('finish', () => actor.set('system'));
  next();
}

module.exports = { access, isAllowed, ROLES };