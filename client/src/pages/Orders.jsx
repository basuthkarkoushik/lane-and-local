import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { Loading, ErrorBox } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api, downloadExport } from '../api';
import { money } from '../utils/format';
import { useAuth } from '../auth';

const STATUSES = ['Pending', 'Assigned', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

export default function Orders() {
  const { role } = useAuth();
  const isOwner = role === 'owner';
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useAsync(() => api.orders({ q, status }), [q, status]);

  return (
    <>
      <PageHeader title={isOwner ? 'Order status' : 'Orders'} subtitle={isOwner ? undefined : 'All delivery quotes and orders with live contribution and feasibility.'}>
        <button className="btn" onClick={() => downloadExport('orders').catch((e) => window.alert(e.message))}>
          <Download size={16} /> Export CSV
        </button>
        {!isOwner && <Link to="/orders/new" className="btn btn-primary">
          <Plus size={16} /> New Delivery Quote
        </Link>}
      </PageHeader>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Search by order reference or customer"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="input" style={{ maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {(q || status) && (
            <button
              className="btn btn-sm"
              onClick={() => {
                setQ('');
                setStatus('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {error && <ErrorBox message={error} onRetry={reload} />}
        {loading && !data && <Loading text="Loading orders..." />}
        {data && data.length === 0 && (
          <EmptyState title="No orders found" text="Try clearing the filters, or create a new delivery quote." />
        )}
        {data && data.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Basket</th>
                  <th>Contribution</th>
                  <th>Feasibility</th>
                  <th>Rider</th>
                  <th>Distance</th>
                  <th>Est. / Promised</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((o) => {
                  const c = o.contribution.valid ? o.contribution.contribution_inr : null;
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders/${o.id}`}>
                          <strong>{o.id}</strong>
                        </Link>
                        {o.restaurant_name && <div className="muted" style={{ fontSize: 12 }}>{o.restaurant_name}</div>}
                        {o.customer && <div className="muted" style={{ fontSize: 12 }}>{o.customer}{o.premium_at_order ? ' · Plus' : ''}</div>}
                      </td>
                      <td>
                        <StatusBadge value={o.status} />
                      </td>
                      <td>{money(o.basket_inr)}</td>
                      <td style={{ fontWeight: 700, color: c !== null && c < 0 ? 'var(--red)' : 'var(--green)' }}>
                        {money(c)}
                      </td>
                      <td>
                        <StatusBadge value={o.feasibility.status} />
                      </td>
                      <td>
                        {o.rider_id || '—'}
                        {o.rider_id && o.rider_response && <div className="muted small" style={{ marginTop: 4 }}>Rider: {o.rider_response}</div>}
                      </td>
                      <td>{o.distance_km} km</td>
                      <td>
                        {o.feasibility.estimated_minutes ?? '—'} / {o.deadline_minutes} min
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <Link to={`/orders/${o.id}`} className="btn btn-sm">
                            View
                          </Link>
                          {!['Delivered', 'Cancelled'].includes(o.status) && (
                            <Link to={`/orders/${o.id}/edit`} className="btn btn-sm">
                              Edit
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}