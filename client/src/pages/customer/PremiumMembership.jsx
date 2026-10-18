import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Gem, HeartHandshake, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../../auth';
import { api } from '../../api';
import { money } from '../../utils/format';
import { ErrorBox, Loading } from '../../components/Feedback';

export default function PremiumMembership() {
  const { name } = useAuth();
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    try {
      setError('');
      setMembership(await api.customerPremium());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function subscribe() {
    if (!window.confirm('Activate Lane & Local Plus in demo mode? This does not charge real money.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await api.customerSubscribePremium();
      setMembership(next);
      setMessage('Lane & Local Plus is active for this demo customer. No real payment was collected.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!window.confirm('Cancel Lane & Local Plus for this demo customer?')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await api.customerCancelPremium();
      setMembership(next);
      setMessage('Your demo membership has been cancelled.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (loading) return <Loading text="Checking your membership..." />;

  const active = Boolean(membership?.is_premium);
  const benefits = membership?.benefits || [
    'Cancel an accepted order any time before food preparation begins.',
    'See order status and delivery updates in one place.',
    'Quicker checkout with your details already at hand in this demo.',
  ];

  return (
    <div className="premium-page">
      <div className="premium-back-row"><Link to="/my-orders"><ArrowLeft size={15} /> Back to my orders</Link></div>
      <section className="premium-hero">
        <div className="premium-hero-copy">
          <div className="premium-kicker"><Sparkles size={14} /> A LITTLE MORE FLEXIBILITY</div>
          <h1>Meet Lane &amp; Local <em>Plus.</em></h1>
          <p>A little more peace of mind when your plans change.</p>
          <div className="premium-price"><strong>{money(membership?.price_inr_per_month || 99)}</strong><span>/ month</span></div>
          <p className="premium-demo-note">Demo subscription only. Activation is simulated and no real payment is collected.</p>
          {active ? (
            <div className="premium-active-label"><Check size={16} /> Your Plus membership is active</div>
          ) : (
            <button className="premium-action" type="button" onClick={subscribe} disabled={busy}>{busy ? 'Activating…' : 'Activate Plus · Demo'} <ArrowRight size={16} /></button>
          )}
          {active && <button className="premium-cancel-link" type="button" onClick={cancel} disabled={busy}>{busy ? 'Please wait…' : 'Cancel membership'}</button>}
        </div>
        <div className="premium-hero-art" aria-hidden="true">
          <div className="premium-orbit orbit-one" /><div className="premium-orbit orbit-two" />
          <div className="premium-gem"><Gem size={57} strokeWidth={1.2} /></div>
          <div className="premium-float-card"><HeartHandshake size={18} /><span><strong>More flexibility</strong><small>On your terms</small></span></div>
        </div>
      </section>

      {error && <div className="premium-feedback"><ErrorBox message={error} /></div>}
      {message && <div className="premium-success"><Check size={17} /> {message}</div>}

      <section className="premium-benefits-section">
        <div className="premium-section-heading"><span>MADE FOR REAL LIFE</span><h2>Plans change. That’s okay.</h2><p>Plus gives you a more flexible cancellation window, before the kitchen starts preparing your food.</p></div>
        <div className="premium-benefit-grid">
          {benefits.map((benefit, index) => (
            <div className="premium-benefit" key={benefit}><span>{index === 0 ? <Clock3Icon /> : index === 1 ? <ShieldCheck size={20} /> : <Sparkles size={20} />}</span><strong>{benefit}</strong></div>
          ))}
        </div>
      </section>

      <section className="premium-policy"><div><ShieldCheck size={19} /><strong>Clear cancellation policy</strong></div><p>Standard customers can cancel while the restaurant is still reviewing the request. Plus members can also cancel after acceptance, as long as the status has not moved to <b>Preparing</b>. Once preparation begins, online cancellation is closed.</p></section>
      <footer className="premium-footer"><span>Lane &amp; Local<span className="premium-dot">.</span></span><Link to="/my-orders/new">Browse neighbourhood food <ArrowRight size={14} /></Link></footer>
    </div>
  );
}

function Clock3Icon() {
  return <span className="premium-clock-icon">◷</span>;
}
