// Remaining capacity for every rider
function riderCapacity(riders) {
  return riders.map((r) => {
    const remaining = Math.max(0, r.max_orders - r.assigned);
    return {
      ...r,
      remaining,
      status: remaining > 0 ? 'Available' : 'Busy',
      utilization_pct: r.max_orders > 0 ? Math.round((r.assigned / r.max_orders) * 100) : 0,
    };
  });
}

function totalAvailable(riders) {
  return riderCapacity(riders).reduce((sum, r) => sum + r.remaining, 0);
}

// Rule: only riders with free capacity; most free slots first, then lowest ID.
// (Fixture has no rider locations, so distance is not used for ranking.)
function recommendRider(riders) {
  const eligible = riderCapacity(riders)
    .filter((r) => r.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining || a.id.localeCompare(b.id));
  return eligible.length > 0 ? eligible[0] : null;
}

module.exports = { riderCapacity, totalAvailable, recommendRider };