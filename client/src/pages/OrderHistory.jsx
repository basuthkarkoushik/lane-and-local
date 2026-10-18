import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { ErrorBox, Loading } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api, downloadExport } from '../api';
import { money, dateTime } from '../utils/format';
import { Download, Search } from 'lucide-react';

const FINAL = new Set(['Delivered', 'Cancelled']);

export default function OrderHistory() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const { data, loading, error, reload } = useAsync(() => api.orders(), []);

  const rows = useMemo(() => (data || []).filter((order) => {
    const q = query.trim().toLowerCase();
    const matches = !q || `${order.id} ${order.customer || ''} ${order.status}`.toLowerCase().includes(q);
    const closed = FINAL.has(order.status);
    return matches && (scope === 'all' || (scope === 'closed' && closed) || (scope === 'active' && !closed));
  }).slice().sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)), [data, query, scope]);

  return (
    <>
      <PageHeader title="Order history">
        <button className="btn" onClick={() => downloadExport('orders').catch((e) => window.alert(e.message))}>
          <Download size={15} /> Download CSV
        </button>
      </PageHeader>
      <div className="card owner-history-filter">
        <div className="owner-history-search"><Search size={16} /><input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order or customer" /></div>
        <div className="owner-history-pills">
          {[['all', 'All orders'], ['active', 'In progress'], ['closed', 'Completed / cancelled']].map(([id, label]) => (
            <button key={id} className={`owner-filter-pill${scope === id ? ' active' : ''}`} onClick={() => setScope(id)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="card">
        {loading && !data && <Loading text="Loading order history…" />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {data && rows.length === 0 && <EmptyState title="No matching orders" text="Try another search or filter." />}
        {data && rows.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Status</th><th>Basket</th><th>Contribution after refunds</th><th>Updated</th></tr></thead>
              <tbody>{rows.map((order) => (
                <tr key={order.id}>
                  <td><strong>{order.id}</strong><div className="muted small">{order.customer || 'Customer order'}</div></td>
                  <td><StatusBadge value={order.status} /></td>
                  <td>{money(order.basket_inr ?? order.total_inr ?? 0)}</td>
                  <td>{order.contribution?.valid ? money(order.contribution.contribution_inr - (Number(order.refund_inr) || 0)) : '—'}</td>
                  <td>{dateTime(order.updated_at || order.created_at)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
