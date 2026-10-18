import { useState } from 'react';
import { MapPin, Phone, Package, Clock3, Bike, RefreshCw, CheckCircle2, XCircle, Navigation, ReceiptText, AlertCircle, UserRound } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { Loading, ErrorBox } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';
import { money, dateTime } from '../utils/format';
import { useAuth } from '../auth';

function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function RiderPortal() {
  const { user, restaurantName } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.riderOrders(), []);
  const [reasons, setReasons] = useState({});
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');

  async function respond(order, action) {
    const reason = String(reasons[order.id] || '').trim();
    if (action === 'reject' && reason.length < 3) {
      setActionError(`Add a short reason before rejecting ${order.id}.`);
      return;
    }
    if (action === 'reject' && !window.confirm(`Reject the delivery assignment for ${order.id}? It will return to the dispatcher queue.`)) return;
    setBusyId(order.id); setActionError(''); setMessage('');
    try {
      await api.respondToRiderOrder(order.id, { action, reason });
      setMessage(action === 'accept' ? `${order.id} accepted. Your response is now visible to dispatch.` : `${order.id} declined and returned to the dispatch queue.`);
      setReasons((old) => ({ ...old, [order.id]: '' }));
      await reload();
    } catch (e) { setActionError(e.message); }
    finally { setBusyId(''); }
  }

  return (
    <div className="rider-portal-page">
      <section className="rider-portal-hero">
        <div className="rider-portal-hero-mark"><Bike size={28} /></div>
        <div className="rider-portal-hero-copy">
          <span className="eyebrow">RIDER WORKSPACE{restaurantName ? ` · ${restaurantName}` : ''}</span>
          <h1>Every delivery, <em>one clear next step.</em></h1>
          <p>Review your assigned orders, check the customer and delivery location, then accept the job or return it to dispatch.</p>
        </div>
        <div className="rider-portal-hero-count"><strong>{data?.orders?.length ?? '—'}</strong><span>active assignment{data?.orders?.length === 1 ? '' : 's'}</span></div>
      </section>

      <PageHeader title={`Hello, ${user?.name?.split(' ')[0] || 'Rider'}`} subtitle="These deliveries are assigned to your rider account. Customer details are only shown for your own assignments.">
        <button className="btn" type="button" onClick={() => reload()}><RefreshCw size={15} /> Refresh deliveries</button>
      </PageHeader>

      {error && <div className="rider-portal-feedback"><ErrorBox message={error} onRetry={reload} /></div>}
      {actionError && <div className="rider-portal-feedback"><ErrorBox message={actionError} /></div>}
      {message && <div className="success-box rider-portal-feedback"><CheckCircle2 size={16} /> {message}</div>}
      {loading && !data && <Loading text="Loading your assigned deliveries…" />}

      {data && data.orders.length === 0 && !loading && (
        <div className="card rider-no-orders"><EmptyState title="No active deliveries assigned" text="When a dispatcher assigns an order to your rider ID, it will appear here with the customer and delivery details." /><div className="rider-no-orders-foot"><Navigation size={16} /> Stay available. New assignments will appear after you refresh.</div></div>
      )}

      <div className="rider-order-list">
        {data?.orders?.map((order) => {
          const responseAccepted = order.rider_response === 'Accepted';
          const canRespond = order.status === 'Assigned' && !responseAccepted;
          return (
            <article className="card rider-delivery-card" key={order.id}>
              <div className="rider-delivery-heading">
                <div className="rider-delivery-order-icon"><Package size={20} /></div>
                <div className="rider-delivery-title"><span className="eyebrow">DELIVERY ORDER</span><h2>{order.id}</h2><small>Assigned {dateTime(order.assigned_at)}</small></div>
                <div className="rider-delivery-status"><StatusBadge value={order.status} />{responseAccepted && <span className="rider-accepted-badge"><CheckCircle2 size={13} /> Accepted by you</span>}</div>
              </div>

              <div className="rider-delivery-details">
                <section className="rider-detail-panel">
                  <div className="rider-detail-panel-title"><UserRound size={15} /> Customer</div>
                  <strong className="rider-customer-name">{order.customer || 'Customer details unavailable'}</strong>
                  {order.phone ? <a className="rider-contact-link" href={`tel:${order.phone}`}><Phone size={14} /> {order.phone}</a> : <span className="muted small">Phone number not provided</span>}
                </section>
                <section className="rider-detail-panel rider-location-panel">
                  <div className="rider-detail-panel-title"><MapPin size={15} /> Delivery location</div>
                  {order.delivery_address ? <><p>{order.delivery_address}</p><a className="rider-map-link" href={mapsUrl(order.delivery_address)} target="_blank" rel="noreferrer"><Navigation size={14} /> Open in Maps</a></> : <div className="rider-location-missing"><AlertCircle size={15} /> No address was saved for this quote. Contact dispatch before accepting.</div>}
                </section>
              </div>

              <div className="rider-order-facts">
                <div><Clock3 size={15} /><span><small>Promised delivery</small><strong>{order.promised_minutes ? `${order.promised_minutes} min` : 'Not specified'}</strong></span></div>
                <div><Navigation size={15} /><span><small>Distance from restaurant</small><strong>{order.distance_km} km</strong></span></div>
                <div><ReceiptText size={15} /><span><small>Payment</small><strong>{order.payment_method ? order.payment_method.replaceAll('_', ' ').toUpperCase() : 'Confirm with dispatch'}</strong></span></div>
                <div><Package size={15} /><span><small>Order total</small><strong>{money(order.total_inr)}</strong></span></div>
              </div>

              <div className="rider-items-section">
                <div className="rider-detail-panel-title"><Package size={15} /> Order items</div>
                {order.items?.length ? <ul className="rider-item-list">{order.items.map((item, index) => <li key={`${item.item_id}-${index}`}><span>{item.name}</span><strong>× {item.quantity}</strong></li>)}</ul> : <p className="muted small">This delivery was created as a quote without item-level details. Confirm the pickup contents with dispatch.</p>}
                {order.payment_status && <p className="rider-payment-note">Payment status: {order.payment_status}</p>}
              </div>

              {canRespond ? (
                <div className="rider-response-panel">
                  <div><strong>Can you take this delivery?</strong><p>Accept it to confirm the assignment, or reject it so dispatch can reassign the order.</p></div>
                  <div className="rider-reject-reason"><label htmlFor={`reject-reason-${order.id}`}>Reason if rejecting</label><input className="input" id={`reject-reason-${order.id}`} value={reasons[order.id] || ''} onChange={(e) => setReasons((old) => ({ ...old, [order.id]: e.target.value }))} placeholder="e.g. Bike issue, outside shift" maxLength={240} /></div>
                  <div className="rider-response-actions">
                    <button className="btn btn-primary" disabled={busyId === order.id} type="button" onClick={() => respond(order, 'accept')}><CheckCircle2 size={15} /> {busyId === order.id ? 'Saving…' : 'Accept delivery'}</button>
                    <button className="btn btn-danger" disabled={busyId === order.id} type="button" onClick={() => respond(order, 'reject')}><XCircle size={15} /> Reject assignment</button>
                  </div>
                </div>
              ) : responseAccepted ? (
                <div className="rider-response-confirmed"><CheckCircle2 size={16} /><span><strong>Assignment accepted</strong><small>Dispatch can see your response. Follow your restaurant’s pickup and delivery process.</small></span></div>
              ) : (
                <div className="rider-response-confirmed rider-response-pending"><AlertCircle size={16} /><span><strong>Order status: {order.status}</strong><small>This order has already moved beyond the assignment stage. Contact dispatch if you need an update.</small></span></div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
