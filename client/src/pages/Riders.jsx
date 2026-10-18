import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, Users, Gauge, Clock } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { Loading, ErrorBox } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';
import { useAuth } from '../auth';

function RiderRow({ r, onDone, onError, canEdit }) {
  const [max, setMax] = useState(String(r.max_orders));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.updateRider(r.id, { max_orders: max });
      onDone(`Capacity for ${r.id} updated to ${max}.`);
    } catch (e) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const cls = r.utilization_pct >= 100 ? 'full' : r.utilization_pct >= 67 ? 'mid' : '';
  const shown = r.eligible_orders.slice(0, 4);

  return (
    <tr>
      <td><strong>{r.id}</strong>{r.account_registered ? <div className="muted small">{r.account_name || 'Rider login active'}</div> : <div className="small rider-login-needed">Login not registered</div>}</td>
      <td><StatusBadge value={r.status} /></td>
      <td style={{ minWidth: 150 }}>
        <div className="small" style={{ marginBottom: 4 }}>
          {r.assigned} of {r.max_orders} ({r.utilization_pct}%)
        </div>
        <div className={`bar ${cls}`}><span style={{ width: `${Math.min(100, r.utilization_pct)}%` }} /></div>
      </td>
      <td style={{ fontWeight: 700 }}>{r.remaining}</td>
      <td className="cell-text">
        {r.current_orders.length === 0 && r.unlinked_assignments === 0 && '—'}
        {r.current_orders.map((id) => (
          <span key={id} style={{ marginRight: 8 }}><Link to={`/orders/${id}`}>{id}</Link></span>
        ))}
        {r.unlinked_assignments > 0 && (
          <div className="muted small">+{r.unlinked_assignments} from the starting data</div>
        )}
      </td>
      <td>{r.workload_minutes > 0 ? `${r.workload_minutes} min` : '—'}</td>
      <td className="cell-text">
        {r.remaining === 0 ? (
          <span className="muted">No free capacity</span>
        ) : shown.length === 0 ? (
          <span className="muted">No eligible pending orders</span>
        ) : (
          <>
            {shown.map((id) => (
              <span key={id} style={{ marginRight: 8 }}><Link to={`/orders/${id}`}>{id}</Link></span>
            ))}
            {r.eligible_orders.length > shown.length && (
              <span className="muted small">+{r.eligible_orders.length - shown.length} more</span>
            )}
          </>
        )}
      </td>
      <td>
        {canEdit ? (
        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <input className="input" type="number" min="1" style={{ width: 70 }} value={max} onChange={(e) => setMax(e.target.value)} />
          <button className="btn btn-sm" disabled={saving || Number(max) === r.max_orders} onClick={save}>Save</button>
        </div>
        ) : (
          <strong>{r.max_orders}</strong>
        )}
      </td>
    </tr>
  );
}

export default function Riders() {
  const { role } = useAuth();
  const isOwner = role === 'owner';
  const { data, loading, error, reload } = useAsync(() => api.riders(), []);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [newId, setNewId] = useState('');
  const [newMax, setNewMax] = useState('3');

  function done(text) {
    setErr(null);
    setMsg(text);
    reload();
  }
  function fail(text) {
    setMsg(null);
    setErr(text);
  }

  async function addRider(e) {
    e.preventDefault();
    try {
      await api.createRider({ id: newId.trim(), max_orders: newMax });
      setNewId('');
      done(`Rider ${newId.trim()} added.`);
    } catch (ex) {
      fail(ex.message);
    }
  }

  if (loading && !data) return <Loading text="Loading riders..." />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const s = data.summary;

  return (
    <>
      <PageHeader title="Rider Management" subtitle="Availability, capacity, assignments and workload for every rider." />

      <div className="stat-grid">
        <StatCard label="Total riders" value={s.total_riders} icon={Users} />
        <StatCard label="Available riders" value={s.available_riders} hint={`${s.busy_riders} busy`} icon={Bike} tone={s.available_riders === 0 ? 'red' : 'green'} />
        <StatCard label="Free capacity" value={s.available_capacity} hint="Orders that can still be taken" icon={Gauge} tone={s.available_capacity === 0 ? 'red' : 'green'} />
        <StatCard label="Recommended rider" value={s.recommended_rider || 'None'} hint="Most free slots, then lowest ID" icon={Clock} />
      </div>

      {s.available_capacity === 0 && (
        <div className="warn-box" style={{ marginTop: 0, marginBottom: 16 }}>
          <strong>Zero available capacity.</strong> Every rider is full, so no new order can be assigned right now.
          Pending orders can be rescheduled to a later slot (+{s.later_slot_minutes} min).
        </div>
      )}
      {msg && <div className="success-box" style={{ marginBottom: 16 }}>{msg}</div>}
      {err && <div style={{ marginBottom: 16 }}><ErrorBox message={err} /></div>}

      {s.unregistered_riders > 0 && <div className="warn-box" style={{ marginTop: 0, marginBottom: 16 }}><strong>{s.unregistered_riders} rider profile(s) need registration.</strong> Ask the owner to create rider sign-in accounts before assigning orders to these profiles.</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Riders</div>
        {data.riders.length === 0 ? (
          <EmptyState title="No riders yet" text="Add a rider below." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Rider</th><th>Availability</th><th>Assignments</th><th>Remaining</th>
                  <th>Current orders</th><th>Workload</th><th>Eligible orders</th><th>Max capacity</th>
                </tr>
              </thead>
              <tbody>
                {data.riders.map((r) => (
                  <RiderRow key={`${r.id}-${r.max_orders}`} r={r} onDone={done} onError={fail} canEdit={isOwner} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {isOwner ? (
        <form className="card" onSubmit={addRider}>
          <div className="card-title">Add a rider</div>
          <div className="form-grid">
            <div className="field">
              <label>Rider ID</label>
              <input className="input" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="e.g. R3" required />
            </div>
            <div className="field">
              <label>Max orders at a time</label>
              <input className="input" type="number" min="1" value={newMax} onChange={(e) => setNewMax(e.target.value)} required />
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }}>Add rider</button>
        </form>
        ) : (
          <div className="card">
            <div className="card-title">Rider fleet</div>
            <p className="muted" style={{ fontSize: 14 }}>Only the business owner can add riders or change their capacity. You can still assign riders to orders.</p>
          </div>
        )}

        <div className="card">
          <div className="card-title">How riders are recommended</div>
          <ol className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
            <li>Only riders with free capacity are considered (max orders minus assigned).</li>
            <li>The rider with the most free slots comes first, then the lowest ID.</li>
            <li>Overbooking is blocked. A full rider can never be assigned.</li>
            <li>Cancelling or delivering an order frees that rider's slot.</li>
          </ol>
          <p className="muted small" style={{ marginTop: 10 }}>
            The supplied data has no rider locations, so distance is not used to rank riders. Eligible orders are pending
            orders that are profitable, inside the service radius and able to meet their promised time.
          </p>
        </div>
      </div>
    </>
  );
}