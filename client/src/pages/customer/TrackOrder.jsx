import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Package, ShieldCheck, Wallet, Clock3, Sparkles } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import OrderTimeline from '../../components/OrderTimeline';
import { Loading, ErrorBox } from '../../components/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../api';
import { money, dateTime } from '../../utils/format';

export default function TrackOrder() {
  const { id } = useParams();
  const { data: order, loading, error, reload } = useAsync(() => api.customerOrder(id), [id]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  // Poll the API for staff-side status changes; this is status polling, not GPS tracking.
  useEffect(() => {
    const timer = setInterval(reload, 8000);
    return () => clearInterval(timer);
  }, [reload]);

  async function cancel() {
    if (!window.confirm(`Cancel order ${id}?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await api.customerCancel(id, { reason });
      setMsg('Your order has been cancelled.');
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !order) return <Loading text="Loading your order..." />;
  if (error && !order) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div className="customer-track-page">
      <PageHeader title={`Order ${order.id}`} subtitle={order.restaurant_name ? `${order.restaurant_name} · placed ${dateTime(order.created_at)}` : `Placed ${dateTime(order.created_at)}`}>
        <Link to="/my-orders" className="btn"><ArrowLeft size={16} /> My orders</Link>
      </PageHeader>

      {msg && <div className="success-box" style={{ marginBottom: 16 }}>{msg}</div>}
      {err && <div style={{ marginBottom: 16 }}><ErrorBox message={err} /></div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'center', marginBottom: 8 }}>
          <StatusBadge value={order.status} />
          {order.is_premium && <span className="customer-premium-badge"><Sparkles size={12} /> Plus member</span>}
        </div>
        <h2 style={{ marginBottom: 7 }}>{order.headline}</h2>
        <p className="muted" style={{ marginBottom: 0 }}>{order.detail}</p>
        <OrderTimeline status={order.status} />

        <div className="info-grid">
          <div className="info-box"><div className="label">Promised time</div><div className="value">{order.promised_minutes} min</div></div>
          {order.estimated_minutes !== null && <div className="info-box"><div className="label">Current estimate</div><div className="value" style={{ color: order.running_late ? 'var(--red)' : 'var(--green)' }}>{order.estimated_minutes} min</div></div>}
          {order.actual_minutes !== null && <div className="info-box"><div className="label">Delivered in</div><div className="value">{order.actual_minutes} min</div></div>}
          <div className="info-box"><div className="label">Rider assignment</div><div className="value" style={{ fontSize: 16 }}>{order.rider_assigned ? 'Assigned' : 'Pending'}</div></div>
        </div>

        {order.delay_minutes > 0 && <div className="warn-box">The restaurant is running about {order.delay_minutes} min late on preparation. Your estimate has been updated.</div>}
        {order.running_late && <div className="warn-box">This order may arrive later than promised. We’re sorry for the wait.</div>}
        {order.original_promised_minutes !== null && order.status !== 'Cancelled' && <div className="warn-box">Your delivery was moved from {order.original_promised_minutes} min to {order.promised_minutes} min.</div>}
        {order.on_time === false && <div className="warn-box">This delivery took longer than promised.</div>}
        {order.on_time === true && <div className="success-box" style={{ marginTop: 16 }}>Delivered on time.</div>}
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title"><Package size={16} style={{ display: 'inline', marginRight: 7 }} />Order summary</div>
          {order.items?.length ? (
            <div className="customer-line-items">
              {order.items.map((item) => <div className="customer-line-item" key={item.item_id}><span>{item.quantity} × {item.name}</span><strong>{money(item.subtotal_inr)}</strong></div>)}
            </div>
          ) : <p className="muted small">This is a legacy delivery request without menu line items.</p>}
          <table className="table" style={{ marginTop: 16 }}>
            <tbody>
              <tr><td>Items subtotal</td><td>{money(order.basket_inr)}</td></tr>
              <tr><td>Delivery fee</td><td>{money(order.delivery_fee_inr)}</td></tr>
              <tr><td><strong>Total</strong></td><td style={{ fontWeight: 800 }}>{money(order.total_inr)}</td></tr>
            </tbody>
          </table>
          <div className="customer-payment-note">
            <div><Wallet size={14} style={{ display: 'inline', marginRight: 6 }} /><strong>Payment:</strong> {order.payment_method || 'Not specified'}</div>
            <div style={{ marginTop: 5 }}><strong>Status:</strong> {order.payment_status || 'Not specified'}</div>
            {order.payment_note && <div style={{ marginTop: 5 }}>{order.payment_note}</div>}
            {order.refund_status && <div style={{ marginTop: 5 }}><strong>Cancellation/payment note:</strong> {order.refund_status}</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-title"><MapPin size={16} style={{ display: 'inline', marginRight: 7 }} />Delivery details</div>
          <div className="info-box"><div className="label">Deliver to</div><div className="value" style={{ fontSize: 13, lineHeight: 1.6 }}>{order.delivery_address || 'Address not recorded on this legacy request'}</div></div>
          {order.phone && <div className="info-box" style={{ marginTop: 10 }}><div className="label">Contact number</div><div className="value" style={{ fontSize: 15 }}>{order.phone}</div></div>}

          {order.can_cancel ? (
            <div style={{ marginTop: 20 }}>
              <div className="card-title">Need to cancel?</div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Reason (optional)</label>
                <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. My plans changed" />
              </div>
              <button className="btn btn-danger" disabled={busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Cancel order'}</button>
              <p className="muted small" style={{ marginTop: 10 }}>{order.cancellation_policy}</p>
            </div>
          ) : (
            <div className="customer-payment-note" style={{ marginTop: 16 }}><ShieldCheck size={14} style={{ display: 'inline', marginRight: 6 }} />{order.cancellation_policy || 'Online cancellation is unavailable at this order stage.'}</div>
          )}

          {!order.is_premium && order.status === 'Assigned' && (
            <Link to="/premium" className="premium-nudge" style={{ marginTop: 15 }}><span className="premium-nudge-icon"><Sparkles size={18} /></span><span className="premium-nudge-copy"><strong>Need more flexibility?</strong><span>Plus members can cancel after acceptance until preparation begins.</span></span><ArrowLeft size={15} style={{ transform: 'rotate(180deg)', color: '#C5754D' }} /></Link>
          )}
          <p className="muted small" style={{ marginTop: 15 }}>Status refreshes every 8 seconds. The tracker is an animated status timeline, not live GPS location.</p>
        </div>
      </div>
    </div>
  );
}
