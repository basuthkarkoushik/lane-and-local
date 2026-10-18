import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, Headset, UserRound, ArrowRight, Leaf } from 'lucide-react';
import { useAuth } from '../auth';
import { homeFor } from '../nav';

const ROLES = [
  {
    key: 'owner',
    icon: Store,
    title: 'Business Owner',
    text: 'Review profitability, rider capacity, service radius, analytics and business settings.',
    action: 'Open owner workspace',
  },
  {
    key: 'dispatcher',
    icon: Headset,
    title: 'Dispatcher',
    text: 'Manage incoming orders, make delivery decisions, assign riders and handle alerts.',
    action: 'Open dispatch desk',
  },
  {
    key: 'customer',
    icon: UserRound,
    title: 'Customer',
    text: 'Place an order, see your delivery fee and estimate, and track or cancel your order.',
    action: 'Continue as customer',
  },
];

export default function RoleSelect() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function choose(role) {
    if (role === 'customer' && name.trim().length < 2) {
      setError('Please enter your name to continue as a customer.');
      return;
    }
    signIn(role, role === 'customer' ? name : '');
    navigate(homeFor(role), { replace: true });
  }

  return (
    <div className="role-page">
      <div className="role-back-row">
        <Link to="/" className="role-back"><ArrowRight size={14} /> Back to Lane &amp; Local</Link>
      </div>
      <div className="role-intro">
        <div className="role-kicker"><Leaf size={14} /> YOUR WORKSPACE, YOUR WAY</div>
        <h1>Who&apos;s joining Lane &amp; Local today?</h1>
        <p>Choose how you&apos;re using the platform. Each role sees only the tools it needs.</p>
      </div>

      <div className="role-grid">
        {ROLES.map(({ key, icon: Icon, title, text, action }) => (
          <div key={key} className={`card role-card role-card-${key}`}>
            <div className="role-icon"><Icon size={23} /></div>
            <h3>{title}</h3>
            <p className="muted">{text}</p>

            {key === 'customer' && (
              <div className="field" style={{ marginBottom: 8 }}>
                <label htmlFor="customer-name">Your name</label>
                <input
                  id="customer-name"
                  className="input"
                  value={name}
                  maxLength={40}
                  placeholder="e.g. Asha"
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && choose('customer')}
                />
                {error && <span className="help" style={{ color: 'var(--red)' }}>{error}</span>}
              </div>
            )}

            <button className="btn btn-primary role-action" onClick={() => choose(key)}>
              {action} <ArrowRight size={15} />
            </button>
          </div>
        ))}
      </div>
      <p className="role-note">Demo sign-in for the prototype. Production authentication is not enabled.</p>
    </div>
  );
}
