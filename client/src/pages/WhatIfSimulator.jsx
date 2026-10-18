import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, Zap } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { Loading, ErrorBox } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';
import { useAuth } from '../auth';
import { money } from '../utils/format';

// label, slider range and step for every value the owner can change
const FIELDS = [
  { key: 'merchant_fee_pct', label: 'Merchant fee (%)', min: 0, max: 40, step: 0.5 },
  { key: 'customer_fee_inr', label: 'Customer delivery fee (₹)', min: 0, max: 100, step: 1 },
  { key: 'rider_cost_inr', label: 'Rider cost (₹)', min: 0, max: 200, step: 1 },
  { key: 'support_inr', label: 'Support cost (₹)', min: 0, max: 50, step: 1 },
  { key: 'payment_inr', label: 'Payment cost (₹)', min: 0, max: 30, step: 0.5 },
  { key: 'distance_km', label: 'Distance (km)', min: 0, max: 10, step: 0.5 },
];

const CHECKS = [
  ['profit', 'Profitability'],
  ['radius', 'Service radius'],
  ['timing', 'Delivery time'],
  ['capacity', 'Rider capacity'],
];

const baselineOf = (o) => Object.fromEntries(FIELDS.map((f) => [f.key, Number(o[f.key])]));

export default function WhatIfSimulator({ embedded = false }) {
  const { role } = useAuth();
  const orders = useAsync(() => api.orders(), []);
  const [orderId, setOrderId] = useState('');
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);
  const [simErr, setSimErr] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const timer = useRef(null);

  // only orders that can still be changed
  const open = useMemo(
    () => (orders.data || []).filter((o) => !['Delivered', 'Cancelled'].includes(o.status)),
    [orders.data]
  );
  const order = open.find((o) => o.id === orderId) || null;
  const baseline = order ? baselineOf(order) : null;

  // pick the first open order automatically
  useEffect(() => {
    if (!orderId && open.length > 0) setOrderId(open[0].id);
  }, [open, orderId]);

  // when the order changes (or is saved), put the sliders back on its saved values
  useEffect(() => {
    if (order) setValues(baselineOf(order));
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, orders.data]);

  // recalculate on the server shortly after the sliders stop moving
  useEffect(() => {
    if (!order || Object.keys(values).length === 0) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await api.simulate({ order_id: order.id, overrides: values });
        setResult(r);
        setSimErr(null);
      } catch (e) {
        setSimErr(e.message);
      }
    }, 250);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, orderId]);

  if (orders.loading && !orders.data) return <Loading text="Loading simulator..." />;
  if (orders.error) return <ErrorBox message={orders.error} onRetry={orders.reload} />;

  if (open.length === 0) {
    return (
      <>
        {!embedded && <PageHeader title="What-If Profit Simulator" subtitle="Try different costs and fees and see the effect before you decide." />}
        <div className="card">
          <EmptyState title="No open orders to simulate" text="Create a new delivery quote first." />
        </div>
      </>
    );
  }

  const changed = baseline && FIELDS.some((f) => Number(values[f.key]) !== baseline[f.key]);

  function setField(key, v) {
    setMsg(null);
    setErr(null);
    setValues((cur) => ({ ...cur, [key]: v }));
  }

  function reset() {
    setMsg(null);
    setErr(null);
    setReason('');
    setValues(baseline);
  }

  // the mandatory example: rider cost 55 -> 85
  function demoLoss() {
    setMsg(null);
    setErr(null);
    setValues({ ...baseline, rider_cost_inr: 85 });
  }

  async function apply() {
    setErr(null);
    setMsg(null);
    if (!reason.trim()) return setErr('Please enter a reason first. It is saved in the decision history.');
    if (!window.confirm(`Save this scenario to ${order.id}? The saved order will change and the decision will be recorded.`)) return;
    setBusy(true);
    try {
      await api.applyScenario({ order_id: order.id, overrides: values, reason, confirm: true });
      setMsg(`Scenario saved to ${order.id} and logged in decision history.`);
      setReason('');
      await orders.reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const o = result && result.original;
  const s = result && result.simulated;
  const diff = result ? result.difference : null;

  return (
    <>
      {!embedded && <PageHeader
        title="What-If Profit Simulator"
        subtitle="Change fees and costs to see the effect on contribution and feasibility. Nothing is saved until you apply it."
      />}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <div className="field" style={{ minWidth: 220 }}>
            <label>Order to simulate</label>
            <select className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              {open.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.id} ({x.status}) · basket {money(x.basket_inr)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }} className="row">
            <button className="btn" onClick={demoLoss} disabled={!order}>
              <Zap size={16} /> Try rider cost ₹85
            </button>
            <button className="btn" onClick={reset} disabled={!changed && !reason}>
              <RotateCcw size={16} /> Reset to baseline
            </button>
            {order && <Link to={`/orders/${order.id}`} className="btn">Open order</Link>}
          </div>
        </div>
      </div>

      {msg && <div className="success-box" style={{ marginBottom: 16 }}>{msg}</div>}
      {err && <div style={{ marginBottom: 16 }}><ErrorBox message={err} /></div>}

      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 16 }}>
        <div className="card">
          <div className="card-title">Adjust the scenario</div>
          <div className="stack" style={{ gap: 18 }}>
            {FIELDS.map((f) => {
              const v = values[f.key] ?? '';
              const diffFromBase = baseline && Number(v) !== baseline[f.key];
              return (
                <div key={f.key} className="field">
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <label>{f.label}</label>
                    <span className="muted small">
                      Baseline: {baseline ? baseline[f.key] : '—'}
                      {diffFromBase && <strong style={{ color: 'var(--primary)' }}> (changed)</strong>}
                    </span>
                  </div>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <input
                      type="range"
                      min={f.min}
                      max={Math.max(f.max, Number(v) || 0)}
                      step={f.step}
                      value={v === '' ? 0 : v}
                      onChange={(e) => setField(f.key, Number(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--primary)' }}
                    />
                    <input
                      className="input"
                      type="number"
                      min={f.min}
                      step={f.step}
                      style={{ width: 90 }}
                      value={v}
                      onChange={(e) => setField(f.key, e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="muted small" style={{ marginTop: 14 }}>
            Rider cost is not scaled by distance automatically, because the supplied data has no per-km rate. Distance
            changes the delivery time and the service-radius check.
          </p>
        </div>

        <div className="stack">
          {simErr && <ErrorBox message={simErr} />}
          {!result && !simErr && <Loading text="Calculating..." />}
          {result && (
            <>
              <div className="card">
                <div className="card-title">Contribution</div>
                <div className="info-grid" style={{ marginTop: 0 }}>
                  <div className="info-box">
                    <div className="label">Original</div>
                    <div className="value">{money(o.contribution)}</div>
                  </div>
                  <div className="info-box">
                    <div className="label">Simulated</div>
                    <div className="value" style={{ color: s.contribution !== null && s.contribution < 0 ? 'var(--red)' : 'var(--green)' }}>
                      {money(s.contribution)}
                    </div>
                  </div>
                  <div className="info-box">
                    <div className="label">Difference</div>
                    <div className="value" style={{ color: diff === null || diff === 0 ? 'var(--text)' : diff < 0 ? 'var(--red)' : 'var(--green)' }}>
                      {diff === null ? '—' : `${diff > 0 ? '+' : ''}${money(diff)}`}
                    </div>
                  </div>
                </div>

                <div className="row" style={{ marginTop: 16 }}>
                  <span className="muted">Feasibility</span>
                  <StatusBadge value={o.feasibility.status} />
                  <span>→</span>
                  <StatusBadge value={s.feasibility.status} />
                </div>

                {s.contribution !== null && s.contribution < 0 && (
                  <div className="error-box" style={{ marginTop: 14 }}>
                    LOSS: this scenario loses {money(Math.abs(s.contribution))} on every order before any other overhead.
                  </div>
                )}
                <p style={{ fontSize: 14, marginTop: 14 }}>{result.explanation}</p>
              </div>

              <div className="card">
                <div className="card-title">Simulated calculation</div>
                {s.breakdown.valid ? (
                  <table className="table">
                    <tbody>
                      <tr><td>Merchant fee</td><td>{money(s.breakdown.merchant_fee_inr)}</td></tr>
                      <tr><td>Customer delivery fee</td><td>{money(s.breakdown.customer_fee_inr)}</td></tr>
                      <tr><td>Rider cost</td><td>- {money(s.breakdown.rider_cost_inr)}</td></tr>
                      <tr><td>Support cost</td><td>- {money(s.breakdown.support_inr)}</td></tr>
                      <tr><td>Payment cost</td><td>- {money(s.breakdown.payment_inr)}</td></tr>
                      <tr>
                        <td><strong>Contribution</strong></td>
                        <td style={{ fontWeight: 800 }}>{money(s.breakdown.contribution_inr)}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <div className="error-box">{s.breakdown.explanation}</div>
                )}
                <div className="stack" style={{ gap: 10, marginTop: 14 }}>
                  {CHECKS.map(([key, label]) => (
                    <div key={key} className="row" style={{ alignItems: 'flex-start', gap: 10, flexWrap: 'nowrap' }}>
                      <div style={{ minWidth: 80 }}><StatusBadge value={s.feasibility.checks[key].status} /></div>
                      <div style={{ fontSize: 13 }}><strong>{label}:</strong> {s.feasibility.checks[key].message}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {role === 'owner' ? (
      <div className="card">
        <div className="card-title">Apply this scenario</div>
        <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
          Applying saves the new values to {order ? order.id : 'the order'}, recalculates its alerts and records the decision.
        </p>
        <div className="row">
          <input
            className="input"
            style={{ flex: 1, minWidth: 260 }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason, e.g. Rider cost rose after fuel price change"
          />
          <button className="btn btn-primary" disabled={busy || !changed} onClick={apply}>
            Apply scenario
          </button>
        </div>
        {!changed && <p className="muted small" style={{ marginTop: 8 }}>Change at least one value to enable Apply.</p>}
      </div>
      ) : (
      <div className="card">
        <div className="card-title">Apply this scenario</div>
        <p className="muted" style={{ fontSize: 14 }}>
          Only the business owner can save a scenario to an order, because it changes commercial terms. You can explore
          freely here and ask the owner to apply it.
        </p>
      </div>
      )}
    </>
  );
}