import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { Loading, ErrorBox } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';
import { money } from '../utils/format';

const PRESETS = [1, 2, 3, 4, 5, 7, 10];

export default function ServiceRadius() {
  const [radii, setRadii] = useState([2, 3, 5]);
  const [proposed, setProposed] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const safeProposed =
    proposed === null
      ? undefined
      : Math.min(50, Math.max(0.5, Number(proposed) || 0.5));

  const key = radii.join(',');

  const { data, loading, error, reload } = useAsync(
    () => api.radiusCompare({ radii: key, proposed: safeProposed }),
    [key, safeProposed]
  );

  // Start with the server's default proposal.
  useEffect(() => {
    if (data && proposed === null) {
      setProposed(data.proposed.radius_km);
    }
  }, [data, proposed]);

  if (loading && !data) {
    return <Loading text="Comparing service radii..." />;
  }

  if (error && !data) {
    return <ErrorBox message={error} onRetry={reload} />;
  }

  const cur = data.current;
  const prop = data.proposed;
  const same = cur.radius_km === prop.radius_km;

  function toggle(km) {
    setRadii((list) => {
      if (list.includes(km)) {
        return list.length > 1
          ? list.filter((x) => x !== km)
          : list;
      }

      return [...list, km].sort((a, b) => a - b);
    });
  }

  async function decide(decision) {
    setErr(null);
    setMsg(null);

    if (!reason.trim()) {
      setErr(
        'Please enter a reason first. It is saved in the decision history.'
      );
      return;
    }

    const confirmation =
      decision === 'Approve'
        ? `Change the service radius from ${cur.radius_km} km to ${prop.radius_km} km? This affects every order check.`
        : `Decline the change to ${prop.radius_km} km and keep ${cur.radius_km} km? The decision will be recorded.`;

    if (!window.confirm(confirmation)) return;

    setBusy(true);

    try {
      await api.radiusApply({
        proposed_km: prop.radius_km,
        reason,
        decision,
        confirm: true,
      });

      setMsg(
        decision === 'Approve'
          ? `Service radius is now ${prop.radius_km} km.`
          : `Kept ${cur.radius_km} km. The decision was recorded.`
      );

      setReason('');
      setProposed(null);
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const smaller = [...data.rows]
    .reverse()
    .find((r) => r.radius_km < cur.radius_km);

  const larger = data.rows.find(
    (r) => r.radius_km > cur.radius_km
  );

  return (
    <>
      <PageHeader
        title="Dynamic Service Radius"
        subtitle="Compare delivery areas before you change them. Wider reach can add orders, but also late-delivery risk."
      />

      {msg && (
        <div className="success-box" style={{ marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {err && (
        <div style={{ marginBottom: 16 }}>
          <ErrorBox message={err} />
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorBox message={error} />
        </div>
      )}

      {/* Radius controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          className="grid-2"
          style={{ alignItems: 'start' }}
        >
          <div>
            <div className="card-title">
              Radii to compare (km)
            </div>

            <div className="row" style={{ gap: 8 }}>
              {PRESETS.map((km) => (
                <button
                  key={km}
                  type="button"
                  className={`btn btn-sm ${
                    radii.includes(km) ? 'btn-primary' : ''
                  }`}
                  onClick={() => toggle(km)}
                >
                  {km} km
                </button>
              ))}
            </div>

            <p
              className="muted small"
              style={{ marginTop: 10 }}
            >
              Current radius:{' '}
              <strong>{cur.radius_km} km</strong>. It is
              always included in the comparison.
            </p>
          </div>

          <div>
            <div className="card-title">
              Proposed radius
            </div>

            <div
              className="row"
              style={{ flexWrap: 'nowrap' }}
            >
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={Math.min(
                  10,
                  Number(proposed) || 0.5
                )}
                onChange={(e) =>
                  setProposed(Number(e.target.value))
                }
                style={{
                  flex: 1,
                  accentColor: 'var(--primary)',
                }}
              />

              <input
                className="input"
                type="number"
                min="0.5"
                max="50"
                step="0.5"
                style={{ width: 90 }}
                value={proposed ?? ''}
                onChange={(e) =>
                  setProposed(
                    e.target.value === ''
                      ? ''
                      : Number(e.target.value)
                  )
                }
              />

              <span>km</span>
            </div>

            <div className="row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!smaller}
                onClick={() =>
                  setProposed(smaller.radius_km)
                }
              >
                Try smaller
                {smaller ? ` (${smaller.radius_km} km)` : ''}
              </button>

              <button
                type="button"
                className="btn btn-sm"
                disabled={!larger}
                onClick={() =>
                  setProposed(larger.radius_km)
                }
              >
                Try larger
                {larger ? ` (${larger.radius_km} km)` : ''}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Trade-off explanation and chart */}
      <div
        className="grid-2"
        style={{
          marginBottom: 16,
          alignItems: 'start',
        }}
      >
        <div className="card">
          <div className="card-title">
            What the trade-off looks like
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            {data.explanation}
          </p>

          <p
            className="muted small"
            style={{ marginTop: 10 }}
          >
            {data.time_model} Change these values in Settings.
          </p>
        </div>

        <div className="card">
          <div className="card-title">
            Orders and risk by radius
          </div>

          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart
                data={data.rows.map((r) => ({
                  name: `${r.radius_km} km`,
                  Serviceable: r.eligible_orders,
                  'At risk': r.at_risk_orders,
                  Outside: r.outside_orders,
                }))}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />

                <Bar
                  dataKey="Serviceable"
                  fill="#244632"
                  radius={[4, 4, 0, 0]}
                />

                <Bar
                  dataKey="At risk"
                  fill="#c38a4b"
                  radius={[4, 4, 0, 0]}
                />

                <Bar
                  dataKey="Outside"
                  fill="#b65e45"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* All radii side by side */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">
          All radii side by side
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Radius</th>
                <th>Serviceable</th>
                <th>Outside</th>
                <th>Avg time</th>
                <th>Edge time</th>
                <th>Free capacity</th>
                <th>At risk</th>
                <th>Total contribution</th>
                <th>Avg / order</th>
              </tr>
            </thead>

            <tbody>
              {data.rows.map((r) => (
                <tr key={r.radius_km}>
                  <td>
                    <strong>{r.radius_km} km</strong>{' '}
                    {r.radius_km === cur.radius_km && (
                      <StatusBadge value="Assigned" />
                    )}
                  </td>

                  <td>{r.eligible_orders}</td>
                  <td>{r.outside_orders}</td>
                  <td>
                    {r.avg_eta_minutes === null
                      ? '—'
                      : `${r.avg_eta_minutes} min`}
                  </td>
                  <td>{r.edge_eta_minutes} min</td>
                  <td>{r.available_capacity}</td>
                  <td>{r.at_risk_orders}</td>
                  <td>{money(r.total_contribution)}</td>
                  <td>
                    {r.avg_contribution === null
                      ? '—'
                      : money(r.avg_contribution)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p
          className="muted small"
          style={{ marginTop: 10 }}
        >
          The badge marks the radius that is live today.
        </p>
      </div>

      {/* Decision */}
      <div className="card">
        <div className="card-title">Decision</div>

        <p
          className="muted"
          style={{ fontSize: 14, marginBottom: 12 }}
        >
          {same
            ? 'Pick a different proposed radius to approve or decline a change.'
            : `Approve to change the radius from ${cur.radius_km} km to ${prop.radius_km} km, or decline to keep ${cur.radius_km} km. Either way the decision is recorded with the original value, the proposed value and your reason.`}
        </p>

        <div className="row">
          <input
            className="input"
            style={{ flex: 1, minWidth: 260 }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason, e.g. Slots stay reliable at 3 km, so keep it"
          />

          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || same}
            onClick={() => decide('Approve')}
          >
            Approve change
          </button>

          <button
            type="button"
            className="btn"
            disabled={busy || same}
            onClick={() => decide('Decline')}
          >
            Decline, keep current
          </button>
        </div>
      </div>
    </>
  );
}