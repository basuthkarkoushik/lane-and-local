import { useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import OwnerNavigation from './components/OwnerNavigation';
import DispatcherNavigation from './components/DispatcherNavigation';
import PageHeader from './components/PageHeader';

import { useAuth } from './auth';
import { NAV, homeFor } from './nav';

import AuthPage from './pages/AuthPage';
import Overview from './pages/Overview';
import Orders from './pages/Orders';
import QuoteForm from './pages/QuoteForm';
import OrderDetail from './pages/OrderDetail';
import Riders from './pages/Riders';
import Feasibility from './pages/Feasibility';
import QuoteWorkbench from './pages/QuoteWorkbench';
import AlertCentre from './pages/AlertCentre';
import ServiceRadius from './pages/ServiceRadius';
import Analytics from './pages/Analytics';
import DecisionHistory from './pages/DecisionHistory';
import Settings from './pages/Settings';
import Placeholder from './pages/Placeholder';
import TeamManagement from './pages/TeamManagement';
import MenuManagement from './pages/MenuManagement';
import OwnerSettings from './pages/OwnerSettings';
import OrderHistory from './pages/OrderHistory';
import RiderPortal from './pages/RiderPortal';

import MyOrders from './pages/customer/MyOrders';
import PlaceOrder from './pages/customer/PlaceOrder';
import TrackOrder from './pages/customer/TrackOrder';
import PremiumMembership from './pages/customer/PremiumMembership';
import LandingPage from './pages/LandingPage';

const STAFF = ['owner', 'dispatcher'];

const BUILT = {
  '/overview': Overview,
  '/orders': Orders,
  '/orders/new': QuoteWorkbench,
  '/riders': Riders,
  '/feasibility': Feasibility,
  '/simulator': QuoteWorkbench,
  '/alerts': AlertCentre,
  '/radius': ServiceRadius,
  '/analytics': Analytics,
  '/history': DecisionHistory,
  '/settings': Settings,
  '/team': TeamManagement,
  '/menu': MenuManagement,
};

function NoAccess({ role }) {
  return (
    <>
      <PageHeader
        title="You don't have access to this page"
        subtitle={`This area isn't available to the ${role} role.`}
      />

      <div className="card">
        <p className="muted">
          Contact your restaurant owner if you need access.
        </p>
      </div>
    </>
  );
}

function Guard({ roles, role, children }) {
  return roles.includes(role)
    ? children
    : <NoAccess role={role} />;
}

export default function App() {
  const { session, role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // Shared public landing page.
  // Signed-in users go to their role's default workspace.
  if (location.pathname === '/') {
    if (role) {
      return <Navigate to={homeFor(role)} replace />;
    }

    return (
      <LandingPage
        onEnter={() => navigate('/login')}
      />
    );
  }

  // Public pages for signed-out users.
  if (!session) {
    if (
      location.pathname === '/login' ||
      location.pathname === '/role-select'
    ) {
      return (
        <div className="public-shopping-shell">
          <Header />
          <AuthPage />
        </div>
      );
    }

    if (location.pathname === '/my-orders/new') {
      return (
        <div className="public-shopping-shell">
          <Header />

          <main className="public-shopping-main">
            <PlaceOrder />
          </main>

          <footer className="public-shopping-footer">
            <span>
              Lane &amp; Local
              <span className="wordmark-dot">.</span>
            </span>

            <button
              type="button"
              onClick={() => navigate('/login')}
            >
              Sign in / Create account
            </button>
          </footer>
        </div>
      );
    }

    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (
    location.pathname === '/login' ||
    location.pathname === '/role-select'
  ) {
    return <Navigate to={homeFor(role)} replace />;
  }

  const staff = (element, roles = STAFF) => (
    <Guard roles={roles} role={role}>
      {element}
    </Guard>
  );

  const compactWorkspace =
    role === 'owner' ||
    role === 'dispatcher' ||
    role === 'rider';

  return (
    <div
      className={`shell ${
        role === 'owner' ? 'owner-shell' : ''
      } ${
        role === 'dispatcher' ? 'dispatcher-shell' : ''
      } ${
        role === 'rider' ? 'rider-shell' : ''
      }`}
    >
      <Header
        onMenu={() =>
          setMenuOpen((open) => !open)
        }
      />

      {role === 'owner' && <OwnerNavigation />}

      {role === 'dispatcher' && (
        <DispatcherNavigation />
      )}

      <div
        className={`body ${
          role === 'owner' ? 'owner-body' : ''
        } ${
          role === 'dispatcher' ? 'dispatcher-body' : ''
        }`}
      >
        {!compactWorkspace && (
          <Sidebar
            open={menuOpen}
            onNavigate={() => setMenuOpen(false)}
          />
        )}

        {!compactWorkspace && (
          <div
            className={`backdrop ${
              menuOpen ? 'show' : ''
            }`}
            onClick={() => setMenuOpen(false)}
          />
        )}

        <main
          className={`main ${
            role === 'owner' ? 'owner-main' : ''
          } ${
            role === 'dispatcher'
              ? 'dispatcher-main'
              : ''
          }`}
        >
          <Routes>
            {/* Rider portal */}
            <Route
              path="/rider"
              element={staff(
                <Navigate
                  to="/rider/orders"
                  replace
                />,
                ['rider']
              )}
            />

            <Route
              path="/rider/orders"
              element={staff(
                <RiderPortal />,
                ['rider']
              )}
            />

            {/* Customers */}
            <Route
              path="/my-orders"
              element={staff(
                <MyOrders />,
                ['customer']
              )}
            />

            <Route
              path="/my-orders/new"
              element={staff(
                <PlaceOrder />,
                ['customer']
              )}
            />

            <Route
              path="/premium"
              element={staff(
                <PremiumMembership />,
                ['customer']
              )}
            />

            <Route
              path="/my-orders/:id"
              element={staff(
                <TrackOrder />,
                ['customer']
              )}
            />

            {/* Old rider registration links now open
                the Rider Registration tab in Team & Access. */}
            <Route
              path="/rider-registration"
              element={staff(
                <Navigate
                  to="/team?tab=riders"
                  replace
                />,
                ['owner']
              )}
            />

            {/* Role-aware workspace pages */}
            {NAV.map(({ path, label, roles }) => {
              let element;

              if (
                path === '/settings' &&
                role === 'owner'
              ) {
                element = <OwnerSettings />;
              } else if (
                path === '/history' &&
                role === 'owner'
              ) {
                element = <OrderHistory />;
              } else if (
                path === '/riders' &&
                role === 'owner'
              ) {
                element = (
                  <Navigate
                    to="/team?tab=riders"
                    replace
                  />
                );
              } else if (
                path === '/alerts' &&
                (role === 'dispatcher' ||
                  role === 'owner')
              ) {
                element = (
                  <Navigate
                    to="/overview#early-warning"
                    replace
                  />
                );
              } else {
                const Page = BUILT[path];

                element = Page
                  ? <Page />
                  : <Placeholder title={label} />;
              }

              return (
                <Route
                  key={path}
                  path={path}
                  element={staff(element, roles)}
                />
              );
            })}

            <Route
              path="/orders/:id/edit"
              element={staff(<QuoteForm />)}
            />

            <Route
              path="/orders/:id"
              element={staff(<OrderDetail />)}
            />

            <Route
              path="*"
              element={
                <Navigate
                  to={homeFor(role)}
                  replace
                />
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}