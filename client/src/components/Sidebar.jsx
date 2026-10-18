import { NavLink } from 'react-router-dom';
import { navFor } from '../nav';
import { useAuth } from '../auth';

export default function Sidebar({ open, onNavigate }) {
  const { role } = useAuth();
  return (
    <nav className={`sidebar ${open ? 'open' : ''}`}>
      {navFor(role).map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end
          onClick={onNavigate}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
      <div className="nav-foot">Prototype with simulated data. Not live GPS tracking.</div>
    </nav>
  );
}