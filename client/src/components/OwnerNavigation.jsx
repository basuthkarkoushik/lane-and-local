import { NavLink } from 'react-router-dom';
import { navFor } from '../nav';
import { useAuth } from '../auth';

export default function OwnerNavigation() {
  const { role } = useAuth();
  return (
    <nav className="owner-topnav" aria-label="Owner navigation">
      <div className="owner-topnav-inner">
        {navFor(role).map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end
            className={({ isActive }) => `owner-topnav-link${isActive ? ' active' : ''}`}
          >
            <Icon size={15} strokeWidth={1.9} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
