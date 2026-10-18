import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { Loading, ErrorBox } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api, downloadExport } from '../api';
import { dateTime } from '../utils/format';

const SHORT = {
  basket_inr: 'basket ₹', merchant_fee_pct: 'merchant fee %', customer_fee_inr: 'customer fee ₹', rider_cost_inr: 'rider cost ₹',
  support_inr: 'support ₹', payment_inr: 'payment ₹', distance_km: 'km', deadline_minutes: 'promise min',
};

function assumptionText(a) {
  if (!a || Object.keys(a).length === 0) return '—';
  return Object.entries(a)
    .map(([k, v]) => (SHORT[k] ? `${SHORT[k]} ${v}` : `${k.replace(/_/g, ' ')} ${v}`))
    .join(' · ');
}

const isOrderRef = (id) => /^OD\d+$/i.test(id);

export default function DecisionHistory() {
  const [q, setQ] = useState('');
  const [decision, setDecision] = useState('');
  const [err, setErr] = useState(null);
  const { data, loading, error, reload } = useAsync(() => api.history({ q, decision }), [q, decision]);

  if (loading && !data) return <Loading text="Loading decision history..." />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Decision History" subtitle="Every decision with its reason, the cost assumptions at the time, and who made it.">
        <button className="btn" onClick={() => downloadExport('history').catch((e) => setErr(e.message))}>
          <Download size={16} /> Export CSV
        </button>
      </PageHeader>

      {err && <div style={{ marginBottom: 16 }}><ErrorBox message={err} /></div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <input className="input" style={{ maxWidth: 300 }} placeholder="Search order, decision, reason..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" style={{ maxWidth: 240 }} value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="">All decisions</option>
            {data.decision_types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="muted small">{data.decisions.length} record(s)</span>
        </div>
      </div>

      <div className="card">
        {data.decisions.length === 0 ? (
          <EmptyState title="No decisions found" text="Decisions appear here when orders are accepted, rejected, rescheduled, cancelled or changed." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>When</th><th>Order</th><th>Decision</th><th>By</th><th>Reason</th><th>Explanation</th><th>Assumptions at the time</th></tr>
              </thead>
              <tbody>
                {data.decisions.map((d) => (
                  <tr key={d.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{dateTime(d.timestamp)}</td>
                    <td>{isOrderRef(d.order_id) ? <Link to={`/orders/${d.order_id}`}><strong>{d.order_id}</strong></Link> : <strong>{d.order_id}</strong>}</td>
                    <td><strong>{d.decision}</strong></td>
                    <td>{d.by ? <span className="badge badge-grey" style={{ textTransform: 'capitalize' }}>{d.by}</span> : '—'}</td>
                    <td className="cell-text">{d.reason || '—'}</td>
                    <td className="cell-text">{d.explanation || '—'}</td>
                    <td className="cell-text muted">{assumptionText(d.assumptions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}