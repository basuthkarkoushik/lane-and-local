import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import {
  ClipboardList, Clock, Bike, Timer, TrendingDown, Wallet, RefreshCw, ArrowUpRight, Activity, BellRing,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { Loading, ErrorBox } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';
import { money, dateTime } from '../utils/format';
import { useAuth } from '../auth';
import AlertCentre from './AlertCentre';
import BrandMark from '../components/BrandMark';

export default function Overview() {
  const { role } = useAuth();
  const location = useLocation();
  const metricsRailRef = useRef(null);
  const scrollMetrics = (direction) => metricsRailRef.current?.scrollBy({ left: direction * 300, behavior: 'smooth' });
  const { data, loading, error, reload } = useAsync(() => api.dashboard(), []);

  useEffect(() => {
    if (location.pathname === '/overview' && location.hash === '#early-warning' && !loading) {
      document.getElementById('early-warning')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.pathname, location.hash, loading]);

  if (loading && !data) return <Loading text="Loading dashboard..." />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <>
      {(role === 'dispatcher' || role === 'owner') ? (
        <section className="dispatch-hero">
          <div className="dispatch-hero-topline">
            <span className="dispatch-brand-pill"><span className="dispatch-brand-symbol"><BrandMark /></span> LANE &amp; LOCAL · {role === 'owner' ? 'OWNER' : 'DISPATCH'}</span>
            <button className="dispatch-refresh" onClick={reload}><RefreshCw size={14} /> Refresh</button>
          </div>
          <div className="dispatch-hero-copy">
            <span className="dispatch-eyebrow">{role === 'owner' ? 'YOUR BUSINESS CONTROL CENTRE' : 'YOUR DELIVERY CONTROL CENTRE'}</span>
            <h1>Every delivery.<br /><em>In the right lane.</em></h1>
            <p>{role === 'owner' ? 'Keep your orders, rider capacity, margins and delivery risks in view.' : 'Build a quote, test the numbers, and spot delivery risks before they become problems.'}</p>
            <div className="dispatch-hero-actions">
              <Link to="/orders/new" className="dispatch-hero-primary">New quote &amp; simulator <ArrowUpRight size={17} /></Link>
              <Link to="/orders" className="dispatch-hero-secondary">View orders <ArrowUpRight size={16} /></Link>
            </div>
          </div>
          <div className="dispatch-rail-heading">
            <span>{role === 'owner' ? 'LIVE BUSINESS PULSE' : 'LIVE DISPATCH PULSE'}</span>
            <div className="dispatch-rail-controls">
              <button type="button" onClick={() => scrollMetrics(-1)} aria-label="Scroll metrics left"><ChevronLeft size={15} /></button>
              <button type="button" onClick={() => scrollMetrics(1)} aria-label="Scroll metrics right"><ChevronRight size={15} /></button>
            </div>
          </div>
          <div className="dispatch-hero-rail" ref={metricsRailRef} tabIndex={0} aria-label="Scrollable live dispatch metrics">
            <Link to="/orders" className="dispatch-hero-card">
              <span className="dispatch-hero-card-icon"><ClipboardList size={17} /></span>
              <span className="dispatch-hero-card-label">Total orders</span>
              <strong>{data.total_orders}</strong>
              <small>All orders in your workspace</small>
            </Link>
            <Link to="/orders" className="dispatch-hero-card dispatch-pending-card">
              <span className="dispatch-hero-card-icon"><Clock size={17} /></span>
              <span className="dispatch-hero-card-label">Pending orders</span>
              <strong>{data.pending_orders}</strong>
              <small>Waiting to move</small>
            </Link>
            <Link to={role === 'owner' ? '/rider-registration' : '/riders'} className="dispatch-hero-card">
              <span className="dispatch-hero-card-icon"><Bike size={17} /></span>
              <span className="dispatch-hero-card-label">Riders available</span>
              <strong>{data.available_riders} / {data.available_riders + data.busy_riders}</strong>
              <small>{data.busy_riders} busy · {data.available_capacity} free slot(s)</small>
            </Link>
            <Link to="/overview#early-warning" className={`dispatch-hero-card dispatch-alert-card${data.active_alert_count ? ' has-alerts' : ''}`}>
              <span className="dispatch-hero-card-icon"><BellRing size={17} /></span>
              <span className="dispatch-hero-card-label">Early alerts</span>
              <strong>{data.active_alert_count}</strong>
              <small>{data.active_alert_count ? 'Needs a quick check' : 'All clear right now'}</small>
            </Link>
            <Link to="/overview#early-warning" className={`dispatch-hero-card${data.at_risk_orders ? ' dispatch-risk-card' : ''}`}>
              <span className="dispatch-hero-card-icon"><Timer size={17} /></span>
              <span className="dispatch-hero-card-label">At risk of being late</span>
              <strong>{data.at_risk_orders}</strong>
              <small>Orders nearing their deadline</small>
            </Link>
            <Link to="/overview#early-warning" className={`dispatch-hero-card${data.unprofitable_orders ? ' dispatch-risk-card' : ''}`}>
              <span className="dispatch-hero-card-icon"><TrendingDown size={17} /></span>
              <span className="dispatch-hero-card-label">Unprofitable orders</span>
              <strong>{data.unprofitable_orders}</strong>
              <small>Contribution at or below zero</small>
            </Link>
            <Link to="/history" className="dispatch-hero-card">
              <span className="dispatch-hero-card-icon"><Wallet size={17} /></span>
              <span className="dispatch-hero-card-label">Avg contribution / order</span>
              <strong>{money(data.avg_contribution)}</strong>
              <small>Total {money(data.total_contribution)}</small>
            </Link>
            <Link to="/history" className="dispatch-hero-card dispatch-health-card">
              <span className="dispatch-hero-card-icon"><Activity size={17} /></span>
              <span className="dispatch-hero-card-label">On-time delivery</span>
              <strong>{data.on_time_pct === null ? '—' : `${data.on_time_pct}%`}</strong>
              <small>{data.on_time_pct === null ? 'Waiting for delivery data' : `${data.delivered_count} delivered orders`}</small>
            </Link>
          </div>
        </section>
      ) : (
        <PageHeader title="Overview" subtitle="Live summary of orders, riders, risk and contribution.">
          <button className="btn" onClick={reload}><RefreshCw size={16} /> Refresh</button>
        </PageHeader>
      )}

      <div id="early-warning" className="dispatcher-alert-workspace">
        <AlertCentre embedded />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Contribution and delivery performance</div>
        {data.chart.length === 0 ? (
          <EmptyState title="No data yet" text="Create a delivery quote to see the chart." />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data.chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e4d9" />
                <XAxis dataKey="order" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: '₹', position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: 'min', position: 'insideRight' }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="contribution" name="Contribution (₹)" fill="#244632" radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="estimated_minutes" name="Estimated time (min)" stroke="#789467" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="promised_minutes" name="Promised time (min)" stroke="#c38a4b" strokeWidth={2} strokeDasharray="5 5" />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Estimated times come from a simple model (preparation + handover + travel at a set speed), not live GPS.
            </p>
          </>
        )}
      </div>

      <div className="card overview-recent-orders">
        <div>
          <div className="card-title">Recent orders</div>
          {data.recent_orders.length === 0 ? (
            <EmptyState title="No orders yet" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Rider</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders/${o.id}`}>{o.id}</Link>
                      </td>
                      <td>
                        <StatusBadge value={o.status} />
                      </td>
                      <td>{o.rider_id || '—'}</td>
                      <td>{dateTime(o.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </>
  );
}