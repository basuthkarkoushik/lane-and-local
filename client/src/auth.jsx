import { createContext, useContext, useState } from 'react';

const KEY = 'lane_local_session';
const API_ROOT = '/api';

export const ROLE_LABEL = {
  owner: 'Restaurant owner',
  dispatcher: 'Dispatcher',
  customer: 'Customer',
  rider: 'Delivery rider',
};

export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!session?.access_token || !session?.user?.role) {
      // Remove older prototype role-only sessions. They are not authenticated credentials.
      localStorage.removeItem(KEY);
      localStorage.removeItem('ndd_session');
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

async function authRequest(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method: 'POST', headers, body: JSON.stringify(body || {}),
    });
  } catch {
    throw new Error('Cannot reach Lane & Local. Make sure the Express server is running.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Unable to complete this request.');
  return data;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getSession);

  function keepSession(next) {
    localStorage.setItem(KEY, JSON.stringify(next));
    setSession(next);
    return next;
  }

  async function signIn(email, password) {
    const data = await authRequest('/auth/login', { email, password });
    return keepSession(data);
  }

  async function register(payload) {
    const data = await authRequest('/auth/register', payload);
    return keepSession(data);
  }

  async function signOut() {
    const current = session;
    try {
      if (current?.access_token) {
        await authRequest('/auth/logout', {}, current.access_token);
      }
    } catch {
      // A local logout must still work if the server is temporarily unavailable.
    }
    localStorage.removeItem(KEY);
    localStorage.removeItem('ndd_session');
    setSession(null);
  }

  const user = session?.user || null;
  return (
    <AuthContext.Provider value={{
      session,
      user,
      role: user?.role || null,
      name: user?.name || '',
      email: user?.email || '',
      restaurantId: user?.restaurant_id || null,
      restaurantName: user?.restaurant_name || '',
      isAuthenticated: Boolean(session?.access_token),
      signIn,
      register,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
