import { Link, useNavigate } from 'react-router-dom';
import { Menu, LogOut, LogIn } from 'lucide-react';
import BrandMark from './BrandMark';
import { useAuth, ROLE_LABEL } from '../auth';

export default function Header({ onMenu }) {
  const { session, user, restaurantName, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <header className="header">
      {session && !['owner', 'dispatcher', 'rider'].includes(user?.role) && <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open menu"><Menu size={19} /></button>}
      <Link to="/" className="brand" aria-label="Lane & Local home">
        <span className="brand-mark"><BrandMark size={24} /></span>
        <span className="wordmark">Lane <span className="wordmark-serif">&amp; Local</span><span className="wordmark-dot">.</span></span>
        <span className="brand-divider" />
        <span className="brand-copy"><span className="brand-title">Neighbourhood Delivery</span><span className="brand-sub">Thoughtful delivery, every day</span></span>
      </Link>

      {session ? (
        <div className="header-user">
          <div className="user-chip">
            <span className={`role-dot role-${user.role}`} />
            <div><div className="user-name">{user.name}</div><div className="user-role">{ROLE_LABEL[user.role]}{restaurantName ? ` · ${restaurantName}` : user.restaurant_name ? ` · ${user.restaurant_name}` : ''}</div></div>
          </div>
          <button className="btn btn-sm switch-role-btn" onClick={handleSignOut} title="Sign out"><LogOut size={14} /><span className="hide-sm">Sign out</span></button>
        </div>
      ) : (
        <Link to="/login" className="btn btn-sm header-signin"><LogIn size={14} /> Sign in</Link>
      )}
    </header>
  );
}
