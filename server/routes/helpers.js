const store = require('../data/store');
let syncAlerts = null;
try { syncAlerts = require('../logic/alerts').syncAlerts; } catch (err) { if (err.code !== 'MODULE_NOT_FOUND') throw err; }

function loadFor(req) {
  return store.loadFor(req);
}

// Refresh one restaurant's alerts using that restaurant's own radius, timing
// policy and rider pool. Other tenants' operational data stays out of the view.
function refreshTenantAlerts(full, skipRestaurantId = null) {
  if (!syncAlerts) return;
  const ids = Array.isArray(full.restaurants) && full.restaurants.length
    ? full.restaurants.map((restaurant) => restaurant.id)
    : [null];

  for (const id of ids) {
    if (id && id === skipRestaurantId) continue;
    if (!id) {
      syncAlerts(full);
      continue;
    }
    const view = store.viewForRestaurant(full, id);
    syncAlerts(view);
    full.alerts = (full.alerts || [])
      .filter((alert) => alert.restaurant_id !== id)
      .concat(view.alerts);
  }
}

// Tenant-scoped writes only merge that restaurant's operational data back into
// the shared JSON database. PostgreSQL transactions should replace this store
// before concurrent production use.
function mutate(req, fn, options = {}) {
  const full = store.load();
  const restaurantId = options.restaurantId || (req && req.role !== 'customer' ? req.restaurantId : null);
  let result;

  if (restaurantId) {
    const view = store.viewForRestaurant(full, restaurantId);
    result = fn(view);
    // Run this tenant's alert reconciliation before merging so callers that
    // return view.alerts receive any alerts created by this operation.
    if (syncAlerts) syncAlerts(view);
    store.mergeTenant(full, view, restaurantId);
    refreshTenantAlerts(full, restaurantId);
  } else {
    result = fn(full);
    refreshTenantAlerts(full);
  }

  store.save(full);
  return result;
}

module.exports = { mutate, loadFor, refreshTenantAlerts };
