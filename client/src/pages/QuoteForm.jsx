import { useEffect, useState } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { Loading, ErrorBox } from '../components/Feedback';
import { api } from '../api';
import { money } from '../utils/format';

// Pre-filled with the C26 example order (₹400 basket, 15% fee, ₹22 contribution)
const DEFAULTS = {
  id: '', customer: '', phone: '', delivery_address: '', basket_inr: '400', merchant_fee_pct: '15', customer_fee_inr: '30',
  rider_cost_inr: '55', support_inr: '8', payment_inr: '5', distance_km: '2', deadline_minutes: '35',
};

const FIELDS = [
  ['basket_inr', 'Basket value (₹)', 'Total value of the food order', '1'],
  ['merchant_fee_pct', 'Merchant fee (%)', 'Percentage of the basket charged to the restaurant', '0.1'],
  ['customer_fee_inr', 'Customer delivery fee (₹)', 'Fee paid by the customer', '1'],
  ['rider_cost_inr', 'Rider cost (₹)', 'What we pay the rider', '1'],
  ['support_inr', 'Support cost (₹)', 'Estimated support cost for this order', '1'],
  ['payment_inr', 'Payment cost (₹)', 'Payment gateway cost', '1'],
  ['distance_km', 'Distance (km)', 'Restaurant to customer', '0.1'],
  ['deadline_minutes', 'Promised delivery time (min)', 'Time promised to the customer', '1'],
];
const NUMERIC = FIELDS.map((f) => f[0]);

function toPayload(form) {
  const out = { customer: form.customer, phone: form.phone, delivery_address: form.delivery_address };
  NUMERIC.forEach((k) => (out[k] = form[k]));
  return out;
}

export default function QuoteForm({ embedded = false }) {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(DEFAULTS);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [scenarioRiderCost, setScenarioRiderCost] = useState(Number(DEFAULTS.rider_cost_inr));
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Edit mode: load the saved order
  useEffect(() => {
    if (!isEdit) return;
    api
      .order(id)
      .then((o) => {
        const next = { ...DEFAULTS, id: o.id, customer: o.customer || '', phone: o.phone || '', delivery_address: o.delivery_address || '' };
        NUMERIC.forEach((k) => (next[k] = String(o[k] ?? '')));
        setForm(next);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  useEffect(() => {
    setScenarioRiderCost(Number(form.rider_cost_inr) || 0);
  }, [form.rider_cost_inr]);

  // Live calculation (done by the server, so it always matches the saved result)
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .previewOrder(toPayload(form))
        .then((r) => !cancelled && setPreview(r))
        .catch((e) => !cancelled && setPreview({ valid: false, errors: [e.message] }));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (isEdit) await api.updateOrder(id, { ...toPayload(form), reason });
      else await api.createOrder({ id: form.id.trim(), ...toPayload(form), reason });
      navigate('/orders');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading text="Loading order..." />;
  if (loadError) return <ErrorBox message={loadError} />;

  const calc = preview && preview.valid ? preview.contribution : null;
  const feas = preview && preview.valid ? preview.feasibility : null;
  const scenarioContribution = calc ? Number(calc.contribution_inr) + Number(calc.rider_cost_inr) - Number(scenarioRiderCost) : null;
  const scenarioDelta = calc ? scenarioContribution - Number(calc.contribution_inr) : 0;
  const scenarioMax = Math.max(200, Number(form.rider_cost_inr) || 0);

  return (
    <>
      {!embedded && <PageHeader
        title={isEdit ? `Edit ${id}` : 'New Delivery Quote'}
        subtitle="Enter the order details. The contribution and feasibility update as you type."
      />}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <form className="card" onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>Order reference</label>
              <input
                className="input"
                value={form.id}
                onChange={set('id')}
                disabled={isEdit}
                placeholder="e.g. OD11"
                required
              />
              <span className="help">Must be unique</span>
            </div>
            <div className="field">
              <label>Customer (optional)</label>
              <input className="input" value={form.customer} onChange={set('customer')} placeholder="Customer name" />
            </div>
            <div className="field">
              <label>Customer phone (optional)</label>
              <input className="input" type="tel" inputMode="numeric" maxLength={16} value={form.phone} onChange={set('phone')} placeholder="10-digit mobile number" />
              <span className="help">Shown to the assigned rider for delivery coordination.</span>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Delivery address (optional)</label>
              <input className="input" value={form.delivery_address} onChange={set('delivery_address')} maxLength={240} placeholder="House, street, area, city, landmark" />
              <span className="help">Riders can open this address in Maps. Customer checkout already supplies its address automatically.</span>
            </div>
            {FIELDS.map(([key, label, help, step]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <input className="input" type="number" min="0" step={step} value={form[key]} onChange={set(key)} required />
                <span className="help">{help}</span>
              </div>
            ))}
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Reason / note {isEdit ? '(saved in decision history)' : '(optional)'}</label>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this quote or change?" />
            </div>
          </div>

          {formError && (
            <div style={{ marginTop: 16 }}>
              <ErrorBox message={formError} />
            </div>
          )}

          <div className="row" style={{ marginTop: 20 }}>
            <button className="btn btn-primary" disabled={saving || (preview && !preview.valid)}>
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create quote'}
            </button>
            <button type="button" className="btn" onClick={() => navigate('/orders')}>
              Cancel
            </button>
          </div>
        </form>

        <div className="card">
          <div className="card-title">Live calculation</div>
          {!preview && <Loading text="Calculating..." />}

          {preview && !preview.valid && (
            <div className="error-box" style={{ display: 'block' }}>
              <strong>Please fix these inputs:</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {preview.errors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {calc && feas && (
            <div className="stack" style={{ gap: 14 }}>
              <table className="table">
                <tbody>
                  <tr><td>Merchant fee ({form.merchant_fee_pct}% of {money(form.basket_inr)})</td><td>{money(calc.merchant_fee_inr)}</td></tr>
                  <tr><td>Customer delivery fee</td><td>{money(calc.customer_fee_inr)}</td></tr>
                  <tr><td><strong>Total income</strong></td><td><strong>{money(calc.revenue_inr)}</strong></td></tr>
                  <tr><td>Rider cost</td><td>- {money(calc.rider_cost_inr)}</td></tr>
                  <tr><td>Support cost</td><td>- {money(calc.support_inr)}</td></tr>
                  <tr><td>Payment cost</td><td>- {money(calc.payment_inr)}</td></tr>
                </tbody>
              </table>

              <div
                style={{
                  padding: 16, borderRadius: 12,
                  background: calc.is_loss ? 'var(--red-soft)' : 'var(--green-soft)',
                  color: calc.is_loss ? 'var(--red)' : 'var(--green)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>Expected contribution</div>
                <div style={{ fontSize: 30, fontWeight: 800 }}>{money(calc.contribution_inr)}</div>
                {calc.is_loss && <div style={{ fontSize: 13 }}>LOSS: this order loses money before any other overhead.</div>}
              </div>

              <div className="quote-simulator-strip">
                <div className="quote-simulator-heading">
                  <span className="quote-simulator-icon"><SlidersHorizontal size={17} /></span>
                  <div>
                    <strong>Quick what-if simulator</strong>
                    <span>{`Test a different rider cost before you ${isEdit ? 'save changes' : 'create the quote'}.`}</span>
                  </div>
                </div>
                <div className="quote-simulator-slider-row">
                  <label htmlFor="quote-scenario-rider-cost">Scenario rider cost</label>
                  <strong>{money(scenarioRiderCost)}</strong>
                </div>
                <input
                  id="quote-scenario-rider-cost"
                  className="quote-simulator-range"
                  type="range"
                  min="0"
                  max={scenarioMax}
                  step="1"
                  value={Math.min(scenarioMax, Math.max(0, Number(scenarioRiderCost) || 0))}
                  onChange={(e) => setScenarioRiderCost(Number(e.target.value))}
                  aria-label="Scenario rider cost slider"
                />
                <div className="quote-simulator-range-labels"><span>₹0</span><span>₹{scenarioMax}</span></div>
                <div className="quote-simulator-preview">
                  <div>
                    <span>Scenario contribution</span>
                    <strong className={scenarioContribution < 0 ? 'is-negative' : 'is-positive'}>{money(scenarioContribution)}</strong>
                  </div>
                  <span className={`quote-simulator-delta${scenarioDelta < 0 ? ' is-negative' : scenarioDelta > 0 ? ' is-positive' : ''}`}>
                    {scenarioDelta > 0 ? `+${money(scenarioDelta)}` : scenarioDelta < 0 ? `−${money(Math.abs(scenarioDelta))}` : money(0)} vs current
                  </span>
                </div>
                <p className="quote-simulator-note"><RotateCcw size={12} /> Preview only. This slider does not change the quote or saved order.</p>
              </div>

              <p className="muted" style={{ fontSize: 12 }}>
                Contribution is not final net profit. It only covers the costs listed above.
              </p>

              <div className="row">
                <span className="muted">Feasibility:</span> <StatusBadge value={feas.status} />
                <span className="muted">
                  Est. {feas.estimated_minutes} min vs promised {feas.promised_minutes} min
                </span>
              </div>
              {feas.reasons.map((r) => (
                <div key={r} className="muted" style={{ fontSize: 13 }}>• {r}</div>
              ))}
              <div style={{ fontSize: 13 }}>
                <strong>Next action:</strong> {feas.next_action}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}