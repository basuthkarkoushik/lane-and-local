const crypto = require('crypto');
const store = require('../data/store');
const actor = require('../logic/actor');

const ROLES = ['owner', 'dispatcher', 'customer', 'rider'];
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

function isPublicPath(method, url) {
  const path = cleanPath(url);
  return (method === 'GET' && path === '/api/customer/restaurants') ||
    (method === 'POST' && path === '/api/customer/estimate') ||
    (method === 'POST' && (path === '/api/auth/register' || path === '/api/auth/login'));
}

function isAllowed(role, method, url) {
  if (!ROLES.includes(role)) return false;
  const path = cleanPath(url);
  const m = String(method).toUpperCase();
  if (path === '/api/health' || isPublicPath(m, path)) return true;
  if (path === '/api/auth/me' || path === '/api/auth/logout') return true;
  if (/^\/api\/auth\/dispatchers(?:\/[^/]+)?$/.test(path)) return role === 'owner';
  if (/^\/api\/auth\/riders(?:\/[^/]+)?$/.test(path)) return role === 'owner';
  if (path === '/api/auth/restaurant') return ['owner', 'dispatcher'].includes(role) && ['GET', 'PUT'].includes(m) && !(m === 'PUT' && role !== 'owner');
  if (/^\/api\/customer(\/|$)/.test(path)) return role === 'customer';
  if (role === 'customer') return false;
  if (role === 'owner') return true;
  if (role === 'rider') {
    return (m === 'GET' && path === '/api/rider/orders') ||
      (m === 'POST' && /^\/api\/rider\/orders\/[^/]+\/respond$/.test(path));
  }
  return DISPATCHER.some(([allowedMethod, re]) => allowedMethod === m && re.test(path));
}

function access(req, res, next) {
  const path = cleanPath(req.originalUrl);
  const method = String(req.method).toUpperCase();
  if (path === '/api/health' || isPublicPath(method, path)) {
    req.role = null;
    req.user = '';
    req.userId = null;
    req.restaurantId = null;
    return next();
  }

  const authHeader = String(req.get('authorization') || '');
  const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1];
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });

  const db = store.load();
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  const session = db.sessions.find((s) => s.token_hash === hash && new Date(s.expires_at).getTime() > now);
  if (!session) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  const user = db.users.find((u) => u.id === session.user_id && u.active !== false);
  if (!user) return res.status(401).json({ error: 'This account is unavailable. Please contact the owner.' });

  req.role = user.role;
  req.user = user.name;
  req.userId = user.id;
  req.email = user.email;
  req.restaurantId = user.restaurant_id || null;
  req.riderId = user.role === 'rider' ? (user.rider_id || null) : null;
  req.sessionId = session.id;
  req.sessionRecord = session;

  if (!ROLES.includes(req.role)) return res.status(401).json({ error: 'Invalid account role.' });
  if (req.role === 'rider') {
    const profile = db.riders.find((r) => r.id === req.riderId && r.restaurant_id === req.restaurantId);
    if (!profile || !req.restaurantId) return res.status(401).json({ error: 'This rider account is not linked to an active rider profile.' });
  }
  if (!isAllowed(req.role, req.method, req.originalUrl)) {
    return res.status(403).json({ error: `The ${req.role} account is not allowed to do this.` });
  }
  actor.set(req.role);
  res.on('finish', () => actor.set('system'));
  next();
}

module.exports = { access, isAllowed, isPublicPath, ROLES };
