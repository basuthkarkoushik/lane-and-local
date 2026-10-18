import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Gem, Plus, RefreshCw, Sparkles } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { Loading, ErrorBox } from '../../components/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../api';
import { money, dateTime } from '../../utils/format';

export default function MyOrders() {
  const [params, setParams] = useSearchParams();
  const placedId = params.get('placed');
  const { data, loading, error, reload } = useAsync(() => api.customerOrders(), []);
  const [membership, setMembership] = useState(null);
  const [membershipError, setMembershipError] = useState('');

  useEffect(() => {
    api.customerPremium().then(setMembership).catch((e) => setMembershipError(e.message));
  }, []);

  useEffect(() => {
    if (placedId && data?.some((o) => o.id === placedId)) {
      const timer = setTimeout(() => setParams({}, { replace: true }), 5000);
      return () => clearTimeout(timer);
    }
  }, [placedId, data, setParams]);

  return (
    <div className="shopper-page customer-orders-page">
      <PageHeader title="My Orders" subtitle="Your orders, all in one place.">
        <button className="btn" onClick={reload}><RefreshCw size={15} /> Refresh</button>
        <Link to="/my-orders/new" className="btn btn-primary"><Plus size={15} /> Order food</Link>
      </PageHeader>

      {placedId && data?.some((o) => o.id === placedId) && <div className="success-box order-placed-banner">Order {placedId} placed successfully. You can track its progress below.</div>}
      {membership && <Link to="/premium" className={`customer-membership-card ${membership.is_premium ? 'active' : ''}`}><span className="customer-membership-icon"><Gem size={20} /></span><span className="customer-membership-copy"><strong>{membership.is_premium ? 'Lane & Local Plus is active' : 'Lane & Local Plus'}</strong><small>{membership.is_premium ? 'Your membership is active.' : `${money(membership.price_inr_per_month)}/month · More flexible cancellation`}</small></span><span className="customer-membership-action">{membership.is_premium ? 'Manage' : 'Explore'} <ArrowRight size={15} /></span></Link>}
      {membershipError && <div className="muted small" style={{ marginBottom: 12 }}>{membershipError}</div>}

      <div className="card">
        {loading && !data && <Loading text="Loading orders…" />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {data && data.length === 0 && <><EmptyState title="No orders yet" text="Choose a restaurant and place your first order." /><div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 22 }}><Link to="/my-orders/new" className="btn btn-primary"><Plus size={15} /> Order food</Link></div></>}
        {data && data.length > 0 && <div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Restaurant</th><th>Status</th><th>Total</th><th>Payment</th><th>Placed</th><th /></tr></thead><tbody>{data.map((o) => <tr key={o.id} className={o.id === placedId ? 'order-placed-row' : ''}><td><strong>{o.id}</strong>{o.is_premium && <span className="customer-premium-badge" style={{ display: 'flex', width: 'fit-content', marginTop: 5 }}><Sparkles size={10} /> Plus</span>}</td><td>{o.restaurant_name || 'Neighbourhood delivery'}<div className="muted small" style={{ marginTop: 3 }}>{o.items?.reduce((n, item) => n + item.quantity, 0) || 0} item(s)</div></td><td><StatusBadge value={o.status} /></td><td><strong>{money(o.total_inr)}</strong></td><td>{o.payment_status || 'Not specified'}</td><td>{dateTime(o.created_at)}</td><td><Link to={`/my-orders/${o.id}`} className="btn btn-sm">Track <ArrowRight size={12} /></Link></td></tr>)}</tbody></table></div>}
      </div>
    </div>
  );
}
