import { NavLink, useLocation } from 'react-router-dom';
import { navFor } from '../nav';
import { useAuth } from '../auth';

export default function DispatcherNavigation() {
  const { role } = useAuth();
  const location = useLocation();

  return (
    <nav className="dispatcher-topnav" aria-label="Dispatcher navigation">
      <div className="dispatcher-topnav-inner">
        {navFor(role).map(({ path, label, icon: Icon }) => {
          const linkedWorkspace = path === '/orders/new' && location.pathname === '/simulator';
          const active = location.pathname === path || linkedWorkspace;
          return (
            <NavLink
              key={path}
              to={path}
              end
              className={`dispatcher-topnav-link${active ? ' active' : ''}`}
            >
              <Icon size={15} strokeWidth={1.9} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
