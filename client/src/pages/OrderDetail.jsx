import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import OrderTimeline from '../components/OrderTimeline';
import EmptyState from '../components/EmptyState';
import { Loading, ErrorBox } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';
import { money, dateTime } from '../utils/format';
import { useAuth } from '../auth';
import { ReceiptText } from 'lucide-react';

const CHECKS = [
  ['profit', 'Profitability'],
  ['radius', 'Service radius'],
  ['timing', 'Delivery time'],
  ['capacity', 'Rider capacity'],
];

const NEXT_STATUS = {
  Assigned: 'Preparing',
  Preparing: 'Out for Delivery',
  'Out for Delivery': 'Delivered',
};

export default function OrderDetail() {
  const { id } = useParams();
  const { role } = useAuth();
  const order = useAsync(() => api.order(id), [id]);
  const riders = useAsync(() => api.riders(), []);

  const [reason, setReason] = useState('');
  const [riderId, setRiderId] = useState('');
  const [delay, setDelay] = useState('');
  const [actual, setActual] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  if (order.loading && !order.data) return <Loading text="Loading order..." />;
  if (order.error) return <ErrorBox message={order.error} onRetry={order.reload} />;

  const o = order.data;
  const f = o.feasibility;
  const c = o.contribution;
  const isFinal = ['Delivered', 'Cancelled'].includes(o.status);
  const delayMin = Number(o.prep_delay_minutes) || 0;
  const freeRiders = riders.data ? riders.data.riders.filter((r) => r.remaining > 0 && r.account_registered) : [];

  async function run(fn, successText) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      await fn();
      setMsg(successText);
      setReason('');
      await Promise.all([order.reload(), riders.reload()]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function needReason() {
    if (!reason.trim()) {
      setErr('Please enter a reason first. It is saved in the decision history.');
      return false;
    }
    return true;
  }

  const decide = (decision, text) => {
    if (!needReason()) return;
    if (decision === 'Reject' && !window.confirm(`Reject ${o.id}? This cancels the quote.`)) return;
    run(() => api.decideOrder(o.id, { decision, reason }), text);
  };

  const cancel = () => {
    if (!needReason()) return;
    if (!window.confirm(`Cancel ${o.id}? Any assigned rider will be released.`)) return;
    run(() => api.cancelOrder(o.id, { reason }), 'Order cancelled and rider capacity updated.');
  };

  const next = NEXT_STATUS[o.status];
  const advance = () =>
    run(
      () =>
        api.setStatus(o.id, {
          status: next,
          reason,
          actual_minutes: next === 'Delivered' ? actual : undefined,
        }),
      `Status updated to ${next}.`
    );

  const assign = () => {
    if (!riderId) return setErr('Choose a rider first.');
    run(() => api.assignRider(o.id, { rider_id: riderId, reason }), `Assigned rider ${riderId}.`);
  };

  const reportDelay = (minutes) =>
    run(() => api.prepDelay(o.id, { minutes, reason }), minutes > 0 ? `Preparation delay of ${minutes} min recorded.` : 'Preparation delay cleared.');

  return (
    <>
      <PageHeader title={o.id} subtitle={o.customer ? `${o.restaurant_name ? `${o.restaurant_name} · ` : ''}Customer: ${o.customer}` : 'Order details and decisions'}>
        <Link to="/orders" className="btn">
          <ArrowLeft size={16} /> Back
        </Link>
        {!isFinal && (
          <Link to={`/orders/${o.id}/edit`} className="btn">
            <Pencil size={16} /> Edit
          </Link>
        )}
      </PageHeader>

      <div className="row" style={{ marginBottom: 16 }}>
        <StatusBadge value={o.status} />
        <span className="muted">Feasibility</span>
        <StatusBadge value={f.status} />
        <span className="muted">Rider: {o.rider_id || 'not assigned'}</span>
        {o.rider_id && o.rider_response && <><span className="muted">Rider response</span><StatusBadge value={o.rider_response} /></>}
      </div>

      {msg && <div className="success-box" style={{ marginBottom: 16 }}>{msg}</div>}
      {err && <div style={{ marginBottom: 16 }}><ErrorBox message={err} /></div>}

      {(o.source === 'customer' || (o.items && o.items.length > 0)) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Customer checkout</div>
          {o.restaurant_name && <div className="info-box" style={{ marginBottom: 12 }}><div className="label">Restaurant</div><div className="value" style={{ fontSize: 16 }}>{o.restaurant_name}</div></div>}
          {o.items && o.items.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Menu item</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead>
                <tbody>{o.items.map((item) => <tr key={item.item_id}><td>{item.name}</td><td>{item.quantity}</td><td>{money(item.unit_price_inr)}</td><td><strong>{money(item.subtotal_inr)}</strong></td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="info-grid">
            {o.delivery_address && <div className="info-box"><div className="label">Delivery address</div><div className="value" style={{ fontSize: 13, lineHeight: 1.5 }}>{o.delivery_address}</div></div>}
            {o.phone && <div className="info-box"><div className="label">Customer phone</div><div className="value" style={{ fontSize: 15 }}>{o.phone}</div></div>}
            {o.payment_method && <div className="info-box"><div className="label">Payment method</div><div className="value" style={{ fontSize: 13 }}>{o.payment_method}</div></div>}
            {o.payment_status && <div className="info-box"><div className="label">Payment status</div><div className="value" style={{ fontSize: 13 }}>{o.payment_status}</div></div>}
            {o.premium_at_order && <div className="info-box"><div className="label">Membership</div><div className="value" style={{ fontSize: 13 }}>Lane &amp; Local Plus</div></div>}
          </div>
          {o.payment_note && <p className="muted small" style={{ marginTop: 10 }}>{o.payment_note}</p>}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Delivery progress</div>
        <OrderTimeline status={o.status} />

        <div className="info-grid">
          <div className="info-box">
            <div className="label">Promised time</div>
            <div className="value">{o.deadline_minutes} min</div>
          </div>
          <div className="info-box">
            <div className="label">Estimated time</div>
            <div className="value" style={{ color: f.checks.timing.status === 'Red' ? 'var(--red)' : 'var(--green)' }}>
              {f.estimated_minutes ?? '—'} min
            </div>
          </div>
          {o.actual_minutes !== undefined && o.actual_minutes !== null && (
            <div className="info-box">
              <div className="label">Actual time</div>
              <div className="value">{o.actual_minutes} min</div>
            </div>
          )}
        </div>

        {delayMin > 0 && (
          <div className="warn-box">
            Restaurant preparation delayed by {delayMin} min. Revised estimate: {f.estimated_minutes} min
            (was {f.estimated_minutes - delayMin} min). Tell the customer about the delay.
          </div>
        )}
        {f.checks.timing.status === 'Red' && !isFinal && (
          <div className="error-box" style={{ marginTop: 16 }}>
            {f.checks.timing.message} This order is not on track to be on time.
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Times are estimated from a simple model. Status updates are simulated, not live GPS tracking.
        </p>
      </div>

      <div className="grid-2" style={{ marginBottom: 16, alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">Contribution</div>
          {c.valid ? (
            <>
              <table className="table">
                <tbody>
                  <tr><td>Merchant fee ({o.merchant_fee_pct}% of {money(o.basket_inr)})</td><td>{money(c.merchant_fee_inr)}</td></tr>
                  <tr><td>Customer delivery fee</td><td>{money(c.customer_fee_inr)}</td></tr>
                  <tr><td>Rider cost</td><td>- {money(c.rider_cost_inr)}</td></tr>
                  <tr><td>Support cost</td><td>- {money(c.support_inr)}</td></tr>
                  <tr><td>Payment cost</td><td>- {money(c.payment_inr)}</td></tr>
                  <tr>
                    <td><strong>Expected contribution</strong></td>
                    <td style={{ fontWeight: 800, color: c.is_loss ? 'var(--red)' : 'var(--green)' }}>{money(c.contribution_inr)}</td>
                  </tr>
                </tbody>
              </table>
              {c.is_loss && <div className="error-box" style={{ marginTop: 12 }}>LOSS: this order loses money before any other overhead.</div>}
              <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{c.explanation}</p>
            </>
          ) : (
            <div className="error-box">{c.explanation}</div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Feasibility checks</div>
          <div className="stack" style={{ gap: 10 }}>
            {CHECKS.map(([key, label]) => (
              <div key={key} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 120 }}>
                  <StatusBadge value={f.checks[key].status} />
                </div>
                <div style={{ fontSize: 14 }}>
                  <strong>{label}:</strong> {f.checks[key].message}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 14 }}>
            <strong>Recommended next action:</strong> {f.next_action}
          </div>
        </div>
      </div>

      {role === 'owner' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title"><ReceiptText size={16} style={{ verticalAlign: -3, marginRight: 7 }} />Refund</div>
          <div className="info-grid" style={{ marginTop: 0, marginBottom: 14 }}>
            <div className="info-box"><div className="label">Recorded refund</div><div className="value">{money(Number(o.refund_inr) || 0)}</div></div>
            <div className="info-box"><div className="label">Contribution after refund</div><div className="value" style={{ color: (c.valid ? c.contribution_inr - (Number(o.refund_inr) || 0) : 0) < 0 ? 'var(--red)' : 'var(--green)' }}>{c.valid ? money(c.contribution_inr - (Number(o.refund_inr) || 0)) : '—'}</div></div>
          </div>
          <div className="form-grid">
            <div className="field"><label>Total refund amount (₹)</label><input className="input" type="number" min="0" max={o.total_inr ?? o.basket_inr ?? 1000000} step="1" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder={String(Number(o.refund_inr) || 0)} /></div>
            <div className="field"><label>Reason</label><input className="input" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} maxLength={240} placeholder="Reason for refund" /></div>
          </div>
          <div className="row" style={{ marginTop: 13 }}>
            <button className="btn btn-primary" disabled={busy || refundAmount === '' || !refundReason.trim()} onClick={() => {
              if (!window.confirm(`Save a total refund of ${money(Number(refundAmount))} for ${o.id}?`)) return;
              run(() => api.recordRefund(o.id, { refund_inr: Number(refundAmount), reason: refundReason.trim() }), 'Refund amount saved and added to the decision history.');
              setRefundAmount(''); setRefundReason('');
            }}>Save refund</button>
          </div>
        </div>
      )}

      {!isFinal && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Actions</div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Reason (required for Accept, Reject, Reschedule and Cancel)</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Rider free and margin is healthy" />
          </div>

          {o.status === 'Pending' && (
            <>
              <div className="row" style={{ marginBottom: 16 }}>
                <button className="btn btn-primary" disabled={busy} onClick={() => decide('Accept', 'Order accepted and the recommended rider was assigned.')}>
                  Accept
                </button>
                <button className="btn" disabled={busy} onClick={() => decide('Reschedule', 'Order rescheduled to a later slot.')}>
                  Reschedule
                </button>
                <button className="btn btn-danger" disabled={busy} onClick={() => decide('Reject', 'Order rejected.')}>
                  Reject
                </button>
              </div>

              <div className="row" style={{ marginBottom: 16 }}>
                <select className="input" style={{ maxWidth: 260 }} value={riderId} onChange={(e) => setRiderId(e.target.value)}>
                  <option value="">Choose a rider manually</option>
                  {freeRiders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} ({r.remaining} slot(s) free)
                    </option>
                  ))}
                </select>
                <button className="btn" disabled={busy || freeRiders.length === 0} onClick={assign}>
                  Assign rider
                </button>
                {riders.data && freeRiders.length === 0 && (
                  <span className="muted" style={{ fontSize: 13 }}>
                    {riders.data.summary.unregistered_riders > 0
                      ? `${riders.data.summary.unregistered_riders} rider profile(s) need an owner-created login before they can receive assignments.`
                      : `No registered rider has free capacity. Suggested later slot: +${riders.data.summary.later_slot_minutes} min.`}
                  </span>
                )}
              </div>
            </>
          )}

          {next && (
            <div className="row" style={{ marginBottom: 16 }}>
              {next === 'Delivered' && (
                <input
                  className="input"
                  style={{ maxWidth: 220 }}
                  type="number"
                  min="0"
                  placeholder="Actual time in min (optional)"
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                />
              )}
              <button className="btn btn-primary" disabled={busy} onClick={advance}>
                Mark as {next}
              </button>
            </div>
          )}

          {['Pending', 'Assigned', 'Preparing'].includes(o.status) && (
            <div className="row" style={{ marginBottom: 16 }}>
              <input
                className="input"
                style={{ maxWidth: 220 }}
                type="number"
                min="0"
                max="240"
                placeholder="Prep delay in minutes"
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
              />
              <button className="btn" disabled={busy || delay === ''} onClick={() => reportDelay(Number(delay))}>
                Report preparation delay
              </button>
              {delayMin > 0 && (
                <button className="btn btn-sm" disabled={busy} onClick={() => reportDelay(0)}>
                  Clear delay
                </button>
              )}
            </div>
          )}

          <button className="btn btn-danger" disabled={busy} onClick={cancel}>
            Cancel order
          </button>
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">Alerts for this order</div>
          {o.alerts.length === 0 ? (
            <EmptyState title="No alerts" text="Nothing has been flagged for this order." />
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {o.alerts.map((a) => (
                <div key={a.id} style={{ borderBottom: '1px solid #f0f1f6', paddingBottom: 10 }}>
                  <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                    <StatusBadge value={a.severity} />
                    <StatusBadge value={a.status} />
                    <strong style={{ fontSize: 14 }}>{a.type}</strong>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>{a.reason}</div>
                  {a.resolution && <div style={{ fontSize: 13, marginTop: 4 }}>Resolution: {a.resolution}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Decision history</div>
          {o.decisions.length === 0 ? (
            <EmptyState title="No decisions yet" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>When</th><th>Decision</th><th>Reason</th></tr>
                </thead>
                <tbody>
                  {o.decisions.slice().reverse().map((d) => (
                    <tr key={d.id}>
                      <td>{dateTime(d.timestamp)}</td>
                      <td>
                        <strong>{d.decision}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>{d.explanation}</div>
                      </td>
                      <td>{d.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}