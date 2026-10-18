import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { Loading, ErrorBox } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';
import { money } from '../utils/format';

export default function Feasibility() {
  const { data, loading, error, reload } = useAsync(() => api.orders(), []);
  const [filter, setFilter] = useState('');
  const [openOnly, setOpenOnly] = useState(true);

  if (loading && !data) return <Loading text="Checking feasibility..." />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const base = data.filter((o) => !openOnly || !['Delivered', 'Cancelled'].includes(o.status));
  const count = (s) => base.filter((o) => o.feasibility.status === s).length;
  const list = base.filter((o) => !filter || o.feasibility.status === filter);

  return (
    <>
      <PageHeader title="Smart Feasibility" subtitle="Each order gets a Green, Amber or Red result from transparent rules, with the reasons shown." />

      <div className="stat-grid">
        <StatCard label="Green (feasible)" value={count('Green')} icon={CheckCircle2} tone="green" />
        <StatCard label="Amber (needs review)" value={count('Amber')} icon={AlertTriangle} tone="amber" />
        <StatCard label="Red (not feasible)" value={count('Red')} icon={XCircle} tone="red" />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <select className="input" style={{ maxWidth: 200 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All results</option>
            <option value="Green">Green</option>
            <option value="Amber">Amber</option>
            <option value="Red">Red</option>
          </select>
          <label className="row" style={{ gap: 6, fontSize: 14 }}>
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
            Open orders only
          </label>
          <button className="btn btn-sm" onClick={reload}>Refresh</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        {list.length === 0 ? (
          <EmptyState title="No orders match" text="Change the filter or create a new quote." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th><th>Result</th><th>Contribution</th><th>Rider availability</th>
                  <th>Estimated vs promised</th><th>Service radius</th><th>Reasons</th><th>Recommended action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => {
                  const f = o.feasibility;
                  const c = f.contribution;
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders/${o.id}`}><strong>{o.id}</strong></Link>
                        <div><StatusBadge value={o.status} /></div>
                      </td>
                      <td><StatusBadge value={f.status} /></td>
                      <td style={{ fontWeight: 700, color: c !== null && c < 0 ? 'var(--red)' : 'var(--green)' }}>{money(c)}</td>
                      <td className="cell-text">{f.checks.capacity.message}</td>
                      <td className="cell-text">{f.checks.timing.message}</td>
                      <td className="cell-text">{f.checks.radius.message}</td>
                      <td className="cell-text">{f.reasons.join(' ')}</td>
                      <td className="cell-text">{f.next_action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">The rules (no hidden scoring)</div>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8 }}>
          <li><strong>Red:</strong> negative contribution, invalid input, order outside the service radius, or the estimated time is later than the promised time.</li>
          <li><strong>Amber:</strong> no rider has free capacity (a later slot is proposed), or the margin is thin (under ₹5).</li>
          <li><strong>Green:</strong> positive contribution, inside the radius, can meet the promise and a rider is available.</li>
          <li>Profit, distance, time and rider capacity are checked independently. A profitable order is not Green if no rider is free.</li>
          <li>Estimated time = preparation + handover + travel at a set speed. This is an estimate, not live GPS. Change the values in Settings.</li>
        </ul>
      </div>
    </>
  );
}