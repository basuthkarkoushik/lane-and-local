import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { Loading, ErrorBox } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';
import { money } from '../utils/format';

const STATUS_COLORS = {
  Pending: '#c38a4b', Assigned: '#8ba775', Preparing: '#d99b78',
  'Out for Delivery': '#244632', Delivered: '#789467', Cancelled: '#b65e45',
};

function Chart({ title, hint, children, empty }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {empty ? <EmptyState title="No data yet" text={empty} /> : <div style={{ width: '100%', height: 260 }}>{children}</div>}
      {hint && <p className="muted small" style={{ marginTop: 8 }}>{hint}</p>}
    </div>
  );
}

export default function Analytics() {
  const { data, loading, error, reload } = useAsync(() => api.analytics(), []);

  if (loading && !data) return <Loading text="Crunching the numbers..." />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const { total_orders, by_status, contribution_by_order, profitable_vs_unprofitable: pv, on_time, cancellation, flagged_orders, rider_utilization, refunds } = data;
  const avgAfterRefunds = refunds.available && refunds.contribution_after_refunds_per_order !== null
    ? refunds.contribution_after_refunds_per_order
    : null;

  const pie = [
    { name: 'Profitable', value: pv.profitable, color: '#789467' },
    { name: 'Unprofitable', value: pv.unprofitable, color: '#b65e45' },
  ].filter((p) => p.value > 0);

  return (
    <>
      <PageHeader title="Analytics" />

      <div className="stat-grid analytics-owner-metrics">
        <StatCard
          label="On-time delivery rate"
          value={on_time.pct === null ? '—' : `${on_time.pct}%`}
          hint={on_time.pct === null ? 'No actual delivery times recorded' : `${on_time.on_time} of ${on_time.delivered_with_time} on time`}
          icon={Clock}
          tone={on_time.pct === null ? '' : on_time.pct >= 80 ? 'green' : 'amber'}
        />
        <StatCard
          label="Contribution / order after refunds"
          value={avgAfterRefunds === null ? '—' : money(avgAfterRefunds)}
          hint={avgAfterRefunds === null ? 'Record a refund to enable this metric' : 'Average for non-cancelled orders'}
          icon={TrendingUp}
          tone={avgAfterRefunds !== null && avgAfterRefunds < 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Flagged orders"
          value={flagged_orders.pct === null ? '—' : `${flagged_orders.pct}%`}
          hint={`${flagged_orders.count} of ${flagged_orders.eligible_orders} non-cancelled orders`}
          icon={AlertTriangle}
          tone={flagged_orders.count > 0 ? 'amber' : 'green'}
        />
      </div>

      <div className="grid-2" style={{ marginBottom: 16, alignItems: 'start' }}>
        <Chart title="Orders by status" empty={total_orders === 0 ? 'Create a quote to see this chart.' : null}>
          <ResponsiveContainer>
            <BarChart data={by_status}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Orders" radius={[4, 4, 0, 0]}>
                {by_status.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Chart>

        <Chart title="Profitable vs unprofitable orders" empty={pie.length === 0 ? 'No live orders to compare.' : null} hint="Unprofitable means negative contribution. Contribution is not final net profit.">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} label>
                {pie.map((p) => <Cell key={p.name} fill={p.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Chart>
      </div>

      <div className="grid-2" style={{ marginBottom: 16, alignItems: 'start' }}>
        <Chart title="Contribution by order after recorded refunds (₹)" empty={contribution_by_order.length === 0 ? 'No live orders yet.' : null} hint="Red bars are orders that lose money.">
          <ResponsiveContainer>
            <BarChart data={contribution_by_order}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="order" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip formatter={(v) => money(v)} />
              <Bar dataKey="contribution" name="Contribution" radius={[4, 4, 0, 0]}>
                {contribution_by_order.map((c) => <Cell key={c.order} fill={c.contribution < 0 ? '#b65e45' : '#244632'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Chart>

        <Chart title="Rider utilisation (%)" empty={rider_utilization.length === 0 ? 'No riders yet.' : null} hint="Assigned orders as a share of each rider's maximum.">
          <ResponsiveContainer>
            <BarChart data={rider_utilization}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="rider" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(v, n, p) => [`${v}% (${p.payload.assigned} of ${p.payload.max_orders})`, 'Utilisation']} />
              <Bar dataKey="utilization_pct" name="Utilisation" radius={[4, 4, 0, 0]}>
                {rider_utilization.map((r) => <Cell key={r.rider} fill={r.utilization_pct >= 100 ? '#b65e45' : r.utilization_pct >= 67 ? '#c38a4b' : '#244632'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Chart>
      </div>

      <div className="card">
        <div className="card-title">Contribution after refunds</div>
        {refunds.available ? (
          <div className="info-grid" style={{ marginTop: 0 }}>
            <div className="info-box"><div className="label">Total refunds</div><div className="value">{money(refunds.total_refunds)}</div></div>
            <div className="info-box"><div className="label">Total contribution after refunds</div><div className="value">{money(refunds.contribution_after_refunds)}</div></div>
            <div className="info-box"><div className="label">Average per order after refunds</div><div className="value">{refunds.contribution_after_refunds_per_order === null ? '—' : money(refunds.contribution_after_refunds_per_order)}</div></div>
          </div>
        ) : (
          <EmptyState title="No refunds recorded" text="Use an order's detail page to record a refund." />
        )}
      </div>

      <p className="muted small" style={{ marginTop: 16 }}>
        On-time rate uses delivered orders with actual times. A flagged order has an active alert, a non-green feasibility result, negative contribution or a recorded late delivery.
      </p>
    </>
  );
}