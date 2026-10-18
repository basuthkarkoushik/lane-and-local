import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, RefreshCw, BellRing, OctagonAlert, TriangleAlert, Info, CheckCircle2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { Loading, ErrorBox } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api, downloadExport } from '../api';
import { money, dateTime } from '../utils/format';

const TYPES = [
  'Likely late',
  'No eligible rider',
  'Negative contribution',
  'Restaurant preparation delay',
  'Cancellation needs action',
  'Quote affected by cost change',
  'Outside service radius',
];

const label = (k) => k.replace(/_/g, ' ').replace(/\binr\b/, '(₹)').replace(/^./, (c) => c.toUpperCase());

function showValue(key, v) {
  if (v === null || v === undefined) return '—';
  if (key === 'changes' && typeof v === 'object') {
    return Object.entries(v).map(([k, c]) => `${k.replace(/_/g, ' ')} ${c.from} → ${c.to}`).join(', ');
  }
  if (typeof v === 'object') return JSON.stringify(v);
  if (key.endsWith('_inr')) return money(v);
  if (key.endsWith('_at')) return dateTime(v);
  return String(v);
}

function AlertCard({ a, onChanged, onError }) {
  const [resolving, setResolving] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const resolved = a.status === 'Resolved';

  async function run(fn, done) {
    setBusy(true);
    try {
      await fn();
      setResolving(false);
      setText('');
      onChanged(done);
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const tone = a.severity === 'Critical' ? 'var(--red)' : a.severity === 'Warning' ? 'var(--amber)' : 'var(--blue)';

  return (
    <div className="card" style={{ borderLeft: `4px solid ${tone}`, opacity: resolved ? 0.85 : 1 }}>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <StatusBadge value={a.severity} />
        <StatusBadge value={a.status} />
        <strong>{a.type}</strong>
        <span className="muted small">{a.id}</span>
        <Link to={`/orders/${a.order_id}`} style={{ marginLeft: 'auto', fontWeight: 700 }}>Order {a.order_id}</Link>
      </div>

      <p style={{ fontSize: 14, marginBottom: 10 }}>{a.reason}</p>

      {a.values && Object.keys(a.values).length > 0 && (
        <div className="info-grid" style={{ marginTop: 0, marginBottom: 10 }}>
          {Object.entries(a.values).map(([k, v]) => (
            <div key={k} className="info-box">
              <div className="label">{label(k)}</div>
              <div className="value" style={{ fontSize: 15 }}>{showValue(k, v)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 14, marginBottom: 10 }}>
        <strong>Suggested action:</strong> {a.suggested_action}
      </div>

      <div className="muted small" style={{ marginBottom: resolved || !resolving ? 0 : 10 }}>
        Raised {dateTime(a.created_at)}
        {a.acknowledged_at && ` · Acknowledged ${dateTime(a.acknowledged_at)}`}
        {resolved && ` · Resolved ${dateTime(a.resolved_at)} by ${a.resolved_by === 'system' ? 'the system' : 'a user'}`}
      </div>

      {resolved && a.resolution && (
        <div className="success-box" style={{ marginTop: 10 }}>Resolution: {a.resolution}</div>
      )}

      {!resolved && (
        <div style={{ marginTop: 12 }}>
          {resolving ? (
            <div className="row">
              <input
                className="input"
                style={{ flex: 1, minWidth: 240 }}
                placeholder="What was done? e.g. Customer told, rescheduled"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                className="btn btn-primary btn-sm"
                disabled={busy || !text.trim()}
                onClick={() => run(() => api.resolveAlert(a.id, { resolution: text }), `${a.id} resolved.`)}
              >
                Save resolution
              </button>
              <button className="btn btn-sm" onClick={() => setResolving(false)}>Cancel</button>
            </div>
          ) : (
            <div className="row">
              {a.status === 'Open' && (
                <button className="btn btn-sm" disabled={busy} onClick={() => run(() => api.acknowledgeAlert(a.id), `${a.id} acknowledged.`)}>
                  Acknowledge
                </button>
              )}
              <button className="btn btn-sm" onClick={() => setResolving(true)}>Resolve</button>
              <Link to={`/orders/${a.order_id}`} className="btn btn-sm">Open order</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AlertCentre({ embedded = false }) {
  const [status, setStatus] = useState('Active');
  const [severity, setSeverity] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const { data, loading, error, reload } = useAsync(() => api.alerts({ status, severity, type, q }), [status, severity, type, q]);

  // alerts are recalculated by the server on every request, so a refresh picks up new problems
  useEffect(() => {
    const t = setInterval(reload, 15000);
    return () => clearInterval(t);
  }, [reload]);

  if (loading && !data) return <Loading text="Checking for problems..." />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  const c = data.counts;

  return (
    <section className={embedded ? 'alert-centre-embedded' : 'alert-centre-page'}>
      <PageHeader
        title={embedded ? 'Early-warning alerts' : 'Early-Warning Alert Centre'}
        subtitle={embedded ? 'Acknowledge, resolve, or review active delivery risks right here.' : 'Problems are detected from live order data and cleared automatically when they are fixed.'}
      >
        <button className="btn" onClick={reload}><RefreshCw size={16} /> Refresh</button>
        <button className="btn" onClick={() => downloadExport('alerts').catch((e) => setErr(e.message))}>
          <Download size={16} /> Export CSV
        </button>
      </PageHeader>

      <div className="stat-grid">
        <StatCard label="Active alerts" value={c.active} icon={BellRing} tone={c.active > 0 ? 'amber' : 'green'} />
        <StatCard label="Critical" value={c.critical} icon={OctagonAlert} tone={c.critical > 0 ? 'red' : 'green'} />
        <StatCard label="Warning" value={c.warning} icon={TriangleAlert} tone={c.warning > 0 ? 'amber' : 'green'} />
        <StatCard label="Informational" value={c.informational} icon={Info} />
        <StatCard label="Resolved" value={c.resolved} icon={CheckCircle2} tone="green" hint="Kept for traceability" />
      </div>

      {msg && <div className="success-box" style={{ marginBottom: 16 }}>{msg}</div>}
      {err && <div style={{ marginBottom: 16 }}><ErrorBox message={err} /></div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <select className="input" style={{ maxWidth: 170 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="Active">Active (not resolved)</option>
            <option value="Open">Open</option>
            <option value="Acknowledged">Acknowledged</option>
            <option value="Resolved">Resolved</option>
            <option value="">All statuses</option>
          </select>
          <select className="input" style={{ maxWidth: 160 }} value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">All severities</option>
            <option value="Critical">Critical</option>
            <option value="Warning">Warning</option>
            <option value="Informational">Informational</option>
          </select>
          <select className="input" style={{ maxWidth: 240 }} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All alert types</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="input" style={{ maxWidth: 240 }} placeholder="Search order or reason" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {data.alerts.length === 0 ? (
        <div className="card">
          <EmptyState
            title={status === 'Active' ? 'No active alerts' : 'No alerts match'}
            text={status === 'Active' ? 'Everything looks healthy right now.' : 'Change the filters to see more.'}
          />
        </div>
      ) : (
        <div className="stack">
          {data.alerts.map((a) => (
            <AlertCard
              key={a.id}
              a={a}
              onChanged={(text) => { setErr(null); setMsg(text); reload(); }}
              onError={(text) => { setMsg(null); setErr(text); }}
            />
          ))}
        </div>
      )}

      {!embedded && <p className="muted small" style={{ marginTop: 16 }}>
        The same problem never creates two open alerts. If you resolve an alert but the problem is still there, it stays
        resolved until the problem is fixed and comes back.
      </p>}
    </section>
  );
}