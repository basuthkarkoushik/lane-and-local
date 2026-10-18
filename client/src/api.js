import { getSession } from './auth';

function authHeaders() {
  const session = getSession();
  const headers = { 'Content-Type': 'application/json' };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return headers;
}

async function request(path, { method = 'GET', body } = {}) {
  let response;

  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: authHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Cannot reach the server. Is it running on port 5000?'
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      (data && data.error) || `Request failed (${response.status})`
    );
  }

  return data;
}

function qs(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export const api = {
  // Authentication and team management
  authMe: () => request('/auth/me'),
  dispatchers: () => request('/auth/dispatchers'),

  createDispatcher: (body) =>
    request('/auth/dispatchers', {
      method: 'POST',
      body,
    }),

  removeDispatcher: (id) =>
    request(`/auth/dispatchers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  riderAccounts: () => request('/auth/riders'),

  createRiderAccount: (body) =>
    request('/auth/riders', {
      method: 'POST',
      body,
    }),

  removeRiderAccount: (id) =>
    request(`/auth/riders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  restaurant: () => request('/auth/restaurant'),

  updateRestaurant: (body) =>
    request('/auth/restaurant', {
      method: 'PUT',
      body,
    }),

  // Owner menu management
  ownerMenu: () => request('/menu'),

  addMenuItem: (body) =>
    request('/menu', {
      method: 'POST',
      body,
    }),

  updateMenuItem: (id, body) =>
    request(`/menu/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body,
    }),

  setMenuAvailability: (id, availability) =>
    request(`/menu/${encodeURIComponent(id)}/availability`, {
      method: 'POST',
      body: { availability },
    }),

  removeMenuItem: (id) =>
    request(`/menu/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // General application
  health: () => request('/health'),
  dashboard: () => request('/dashboard'),

  // Orders
  orders: (params) => request(`/orders${qs(params)}`),
  order: (id) => request(`/orders/${encodeURIComponent(id)}`),

  createOrder: (body) =>
    request('/orders', {
      method: 'POST',
      body,
    }),

  updateOrder: (id, body) =>
    request(`/orders/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body,
    }),

  assignRider: (id, body) =>
    request(`/orders/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      body,
    }),

  setStatus: (id, body) =>
    request(`/orders/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body,
    }),

  cancelOrder: (id, body) =>
    request(`/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body,
    }),

  recordRefund: (id, body) =>
    request(`/orders/${encodeURIComponent(id)}/refund`, {
      method: 'POST',
      body,
    }),

  decideOrder: (id, body) =>
    request(`/orders/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body,
    }),

  prepDelay: (id, body) =>
    request(`/orders/${encodeURIComponent(id)}/prep-delay`, {
      method: 'POST',
      body,
    }),

  previewOrder: (body) =>
    request('/orders/preview', {
      method: 'POST',
      body,
    }),

  // Rider management and rider portal
  riders: () => request('/riders'),

  createRider: (body) =>
    request('/riders', {
      method: 'POST',
      body,
    }),

  updateRider: (id, body) =>
    request(`/riders/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body,
    }),

  riderOrders: () => request('/rider/orders'),

  respondToRiderOrder: (id, body) =>
    request(`/rider/orders/${encodeURIComponent(id)}/respond`, {
      method: 'POST',
      body,
    }),

  // Early-warning alerts
  alerts: (params) => request(`/alerts${qs(params)}`),

  acknowledgeAlert: (id) =>
    request(`/alerts/${encodeURIComponent(id)}/acknowledge`, {
      method: 'POST',
      body: {},
    }),

  resolveAlert: (id, body) =>
    request(`/alerts/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      body,
    }),

  // Simulator
  simulate: (body) =>
    request('/simulator/simulate', {
      method: 'POST',
      body,
    }),

  applyScenario: (body) =>
    request('/simulator/apply', {
      method: 'POST',
      body,
    }),

  // Service radius
  radiusCompare: (params) =>
    request(`/radius/compare${qs(params)}`),

  radiusApply: (body) =>
    request('/radius/apply', {
      method: 'POST',
      body,
    }),

  // Analytics and history
  analytics: () => request('/analytics'),
  history: (params) => request(`/history${qs(params)}`),

  // Settings
  settings: () => request('/settings'),

  saveSettings: (body) =>
    request('/settings', {
      method: 'PUT',
      body,
    }),

  // NEW: restaurant GPS location
  restaurantLocation: () => request('/settings/location'),

  saveRestaurantLocation: (body) =>
    request('/settings/location', {
      method: 'PUT',
      body,
    }),

  resetData: () =>
    request('/settings/reset', {
      method: 'POST',
      body: {},
    }),

  // Customer portal
  customerRestaurants: () => request('/customer/restaurants'),

  customerPremium: () => request('/customer/premium'),

  customerSubscribePremium: () =>
    request('/customer/premium/subscribe', {
      method: 'POST',
      body: {},
    }),

  customerCancelPremium: () =>
    request('/customer/premium/cancel', {
      method: 'POST',
      body: {},
    }),

  customerEstimate: (body) =>
    request('/customer/estimate', {
      method: 'POST',
      body,
    }),

  customerPlace: (body) =>
    request('/customer/orders', {
      method: 'POST',
      body,
    }),

  customerOrders: () => request('/customer/orders'),

  customerOrder: (id) =>
    request(`/customer/orders/${encodeURIComponent(id)}`),

  customerCancel: (id, body) =>
    request(`/customer/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body,
    }),
};

// CSV downloads must send the authorization header.
export async function downloadExport(name) {
  let response;

  try {
    response = await fetch(`/api/export/${name}`, {
      headers: authHeaders(),
    });
  } catch {
    throw new Error(
      'Cannot reach the server. Is it running on port 5000?'
    );
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);

    throw new Error(
      (data && data.error) || `Export failed (${response.status})`
    );
  }

  const blobUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');

  anchor.href = blobUrl;
  anchor.download = `${name}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(blobUrl);
}