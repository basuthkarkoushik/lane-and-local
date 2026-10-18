import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, Save, TriangleAlert } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { Loading, ErrorBox } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';

const FIELDS = [
  { key: 'service_radius_km', label: 'Service radius (km)', min: 0.5, step: 0.5, help: 'Orders farther than this are flagged Red. Compare options on the Service Radius page first.' },
  { key: 'prep_minutes', label: 'Restaurant preparation time (min)', min: 0, step: 1, help: 'Typical time to prepare an order. Used in every delivery estimate.' },
  { key: 'handover_minutes', label: 'Rider handover time (min)', min: 0, step: 1, help: 'Time for the rider to collect the order.' },
  { key: 'speed_kmph', label: 'Average rider speed (km/h)', min: 1, step: 1, help: 'Used to estimate travel time. There is no live GPS.' },
  { key: 'later_slot_minutes', label: 'Later slot offset (min)', min: 5, step: 5, help: 'Extra time proposed when no rider is free and an order is rescheduled.' },
  { key: 'thin_margin_inr', label: 'Thin margin threshold (₹)', min: 0, step: 1, help: 'A profitable order below this contribution is marked Amber for review.' },
];

export default function Settings() {
  const { data, loading, error, reload } = useAsync(() => api.settings(), []);
  const [form, setForm] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // copy saved values into the form whenever they load or change
  useEffect(() => {
    if (data) setForm(Object.fromEntries(FIELDS.map((f) => [f.key, String(data[f.key])])));
  }, [data]);

  if ((loading && !data) || !form) return error ? <ErrorBox message={error} onRetry={reload} /> : <Loading text="Loading settings..." />;

  const changed = FIELDS.filter((f) => Number(form[f.key]) !== Number(data[f.key]));
  const set = (k) => (e) => { setMsg(null); setErr(null); setForm((cur) => ({ ...cur, [k]: e.target.value })); };

  // live example so the owner sees what the numbers mean
  const n = (k) => Number(form[k]);
  const example = n('speed_kmph') > 0 ? Math.ceil(n('prep_minutes') + n('handover_minutes') + (2 / n('speed_kmph')) * 60) : null;

  async function save() {
    setErr(null);
    setMsg(null);
    if (!reason.trim()) return setErr('Please enter a reason first. It is saved in the decision history.');
    if (!window.confirm(`Save ${changed.length} change(s)? Every feasibility check, alert and estimate will use the new values.`)) return;
    setBusy(true);
    try {
      const body = { reason };
      changed.forEach((f) => { body[f.key] = form[f.key]; });
      await api.saveSettings(body);
      setMsg('Settings saved. Alerts and estimates were recalculated.');
      setReason('');
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetData() {
    if (!window.confirm('Reset ALL demo data (orders, riders, alerts, decisions and settings) back to the original C26 starting data? This cannot be undone.')) return;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await api.resetData();
      setMsg('Demo data was reset to the original starting data.');
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Business rules used by feasibility checks, alerts, the simulator and the service radius." />

      {msg && <div className="success-box" style={{ marginBottom: 16 }}>{msg}</div>}
      {err && <div style={{ marginBottom: 16 }}><ErrorBox message={err} /></div>}

      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 16 }}>
        <div className="card">
          <div className="card-title">Delivery rules</div>
          <div className="stack" style={{ gap: 16 }}>
            {FIELDS.map((f) => {
              const isChanged = Number(form[f.key]) !== Number(data[f.key]);
              return (
                <div key={f.key} className="field">
                  <label>
                    {f.label}
                    {isChanged && <strong style={{ color: 'var(--primary)', marginLeft: 8, fontSize: 12 }}>changed from {data[f.key]}</strong>}
                  </label>
                  <input className="input" type="number" min={f.min} step={f.step} value={form[f.key]} onChange={set(f.key)} />
                  <span className="help">{f.help}</span>
                </div>
              );
            })}
          </div>

          <div className="field" style={{ marginTop: 20 }}>
            <label>Reason for the change</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Kitchen is faster after the new hire" />
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" disabled={busy || changed.length === 0} onClick={save}>
              <Save size={16} /> Save changes
            </button>
            <button
              className="btn"
              disabled={changed.length === 0}
              onClick={() => { setForm(Object.fromEntries(FIELDS.map((f) => [f.key, String(data[f.key])]))); setErr(null); }}
            >
              <RotateCcw size={16} /> Undo edits
            </button>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title">What these numbers mean</div>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              Estimated delivery time = preparation + handover + travel at the set speed.
            </p>
            {example !== null && (
              <div className="info-grid" style={{ marginTop: 12 }}>
                <div className="info-box">
                  <div className="label">Example: a 2 km order</div>
                  <div className="value">{example} min</div>
                </div>
                <div className="info-box">
                  <div className="label">Edge of the radius ({n('service_radius_km')} km)</div>
                  <div className="value">{Math.ceil(n('prep_minutes') + n('handover_minutes') + (n('service_radius_km') / n('speed_kmph')) * 60)} min</div>
                </div>
              </div>
            )}
            <p className="muted small" style={{ marginTop: 12 }}>
              The preview updates as you type and is not saved until you click Save. These are estimates from a simple model,
              not live routing or GPS. Every saved change is recorded in <Link to="/history">Decision History</Link>.
            </p>
          </div>

          <div className="card" style={{ borderLeft: '4px solid var(--red)' }}>
            <div className="card-title"><TriangleAlert size={16} style={{ verticalAlign: -3 }} /> Demo tools</div>
            <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
              Reset everything back to the original C26 starting data. Use this before a live demo for a clean start.
              All orders (including customer orders), alerts, history and settings are lost.
            </p>
            <button className="btn btn-danger" disabled={busy} onClick={resetData}>Reset demo data</button>
          </div>
        </div>
      </div>
    </>
  );
}