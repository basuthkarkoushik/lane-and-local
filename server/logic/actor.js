// Who is making the current request. Set by middleware/access.js, read when a decision is logged.
// Express handlers here are synchronous, so one shared value per request is safe.
let current = 'system';
module.exports = {
  get: () => current,
  set: (role) => { current = role || 'system'; },
};