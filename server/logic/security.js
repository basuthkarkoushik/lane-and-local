const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, key] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function newId(prefix = 'usr') {
  return `${prefix}_${crypto.randomBytes(9).toString('hex')}`;
}

module.exports = { hashPassword, verifyPassword, newToken, tokenHash, newId };
