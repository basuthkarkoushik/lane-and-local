import { useEffect, useState } from 'react';
import {
  Bike,
  UserPlus,
  Users,
  RefreshCw,
  Trash2,
  KeyRound,
  CheckCircle2,
  CircleAlert,
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import { ErrorBox, Loading } from '../components/Feedback';
import { api } from '../api';
import { useAuth } from '../auth';

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  rider_id: '',
  max_orders: '3',
};

export default function RiderRegistration({
  embedded = false,
} = {}) {
  const { restaurantName } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  async function reload() {
    setLoading(true);
    setError('');

    try {
      setData(await api.riderAccounts());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const unlinkedProfiles = (data?.riders || []).filter(
    (profile) => !profile.account
  );

  const linkedCount = (data?.riders || []).filter(
    (profile) => profile.account?.active
  ).length;

  async function add(event) {
    event.preventDefault();

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await api.createRiderAccount({
        name: form.name,
        email: form.email,
        password: form.password,
        rider_id: form.rider_id || undefined,
        max_orders: Number(form.max_orders),
      });

      setForm(EMPTY_FORM);

      setMessage(
        `Rider account created for ${result.name}. Rider ID: ${result.rider_id}. Share the temporary password securely.`
      );

      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(profile) {
    if (!profile.account) return;

    const confirmed = window.confirm(
      `Deactivate ${profile.account.name}'s rider sign-in? They will not be able to access assigned deliveries.`
    );

    if (!confirmed) return;

    setRemoving(profile.account.id);
    setError('');
    setMessage('');

    try {
      await api.removeRiderAccount(profile.account.id);

      setMessage(
        `Sign-in for ${profile.account.name} has been deactivated.`
      );

      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setRemoving('');
    }
  }

  function useProfile(profile) {
    setForm((old) => ({
      ...old,
      rider_id: profile.id,
      max_orders: String(profile.max_orders || 3),
    }));

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  return (
    <div className="rider-register-page">
      {!embedded && (
        <PageHeader
          title="Rider registration"
          subtitle={
            restaurantName
              ? `${restaurantName} · create sign-in access for your delivery team.`
              : 'Create sign-in access for your delivery team.'
          }
        >
          <button
            className="btn"
            type="button"
            onClick={reload}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </PageHeader>
      )}

      <section className="rider-register-hero">
        <div className="rider-register-hero-symbol">
          <Bike size={28} strokeWidth={1.8} />
        </div>

        <div className="rider-register-hero-copy">
          <span className="eyebrow">
            YOUR DELIVERY TEAM
          </span>

          <h2>Give every rider their own lane.</h2>

          <p>
            Register a rider login so they can view only the
            deliveries assigned to them and accept or reject
            each assignment.
          </p>
        </div>

        <div className="rider-register-counts">
          <div>
            <span>Rider profiles</span>
            <strong>{data?.riders?.length ?? '—'}</strong>
          </div>

          <div>
            <span>Active accounts</span>
            <strong>{linkedCount}</strong>
          </div>
        </div>
      </section>

      {error && (
        <div className="rider-register-feedback">
          <ErrorBox message={error} />
        </div>
      )}

      {message && (
        <div className="success-box rider-register-feedback">
          <CheckCircle2 size={16} /> {message}
        </div>
      )}

      <div className="rider-registration-grid">
        <section className="card rider-register-form-card">
          <div className="rider-register-section-title">
            <span>
              <UserPlus size={18} />
            </span>

            <div>
              <h2>Register a rider</h2>
              <p>
                Provide their sign-in details and assign an
                order capacity.
              </p>
            </div>
          </div>

          <form className="team-form" onSubmit={add}>
            <label>
              <span>Rider profile</span>

              <select
                className="input"
                value={form.rider_id}
                onChange={(e) => {
                  const selected = unlinkedProfiles.find(
                    (profile) =>
                      profile.id === e.target.value
                  );

                  setForm((old) => ({
                    ...old,
                    rider_id: e.target.value,
                    max_orders: selected
                      ? String(selected.max_orders || 3)
                      : old.max_orders,
                  }));
                }}
              >
                <option value="">
                  Create a new rider profile
                </option>

                {unlinkedProfiles.map((profile) => (
                  <option
                    key={profile.id}
                    value={profile.id}
                  >
                    {profile.id} · existing profile
                  </option>
                ))}
              </select>

              <small className="rider-field-help">
                Link an existing capacity profile or create
                a new rider ID automatically.
              </small>
            </label>

            <label>
              <span>Full name</span>

              <input
                className="input"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
                minLength={2}
                maxLength={40}
                required
                placeholder="Rider's full name"
                autoComplete="name"
              />
            </label>

            <label>
              <span>Email address</span>

              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
                maxLength={160}
                required
                placeholder="rider@example.com"
                autoComplete="email"
              />
            </label>

            <label>
              <span>Temporary password</span>

              <div className="rider-password-wrap">
                <KeyRound size={15} />

                <input
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      password: e.target.value,
                    })
                  }
                  minLength={8}
                  maxLength={128}
                  required
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>
            </label>

            <label>
              <span>Maximum active orders</span>

              <input
                className="input"
                type="number"
                value={form.max_orders}
                onChange={(e) =>
                  setForm({
                    ...form,
                    max_orders: e.target.value,
                  })
                }
                min="1"
                max="50"
                required
              />

              <small className="rider-field-help">
                Capacity prevents dispatchers from assigning
                more work than the rider can handle.
              </small>
            </label>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy}
            >
              {busy ? 'Registering…' : 'Register rider account'}
              <UserPlus size={15} />
            </button>
          </form>
        </section>

        <section className="card rider-register-list-card">
          <div className="rider-register-section-title">
            <span>
              <Users size={18} />
            </span>

            <div>
              <h2>Rider profiles & access</h2>
              <p>
                Capacity profiles, linked accounts, and
                sign-in status.
              </p>
            </div>
          </div>

          {loading && !data ? (
            <Loading text="Loading rider profiles…" />
          ) : (data?.riders?.length || 0) === 0 ? (
            <div className="team-empty">
              <Bike size={24} />
              <p>
                No rider profiles yet. Register your first
                rider to create a profile and login.
              </p>
            </div>
          ) : (
            <div className="rider-account-list">
              {data.riders.map((profile) => (
                <article
                  className="rider-account-item"
                  key={profile.id}
                >
                  <span className="rider-account-avatar">
                    <Bike size={18} />
                  </span>

                  <div className="rider-account-main">
                    <div className="rider-account-heading">
                      <strong>{profile.id}</strong>

                      <span
                        className={`rider-account-status ${
                          profile.account?.active
                            ? 'is-active'
                            : profile.account
                              ? 'is-disabled'
                              : 'is-unlinked'
                        }`}
                      >
                        {profile.account?.active
                          ? 'Active login'
                          : profile.account
                            ? 'Deactivated'
                            : 'Not registered'}
                      </span>
                    </div>

                    {profile.account ? (
                      <>
                        <span>
                          {profile.account.name}
                        </span>
                        <small>
                          {profile.account.email}
                        </small>
                      </>
                    ) : (
                      <small>
                        No login account is linked to this
                        profile yet.
                      </small>
                    )}

                    <small>
                      {profile.assigned} / {profile.max_orders}{' '}
                      active capacity ·{' '}
                      {profile.active_order_count} linked orders
                    </small>
                  </div>

                  {profile.account?.active ? (
                    <button
                      className="icon-btn rider-account-remove"
                      type="button"
                      title="Deactivate rider login"
                      aria-label={`Deactivate ${profile.account.name}`}
                      disabled={
                        removing === profile.account.id
                      }
                      onClick={() => deactivate(profile)}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : !profile.account ? (
                    <button
                      className="btn btn-sm"
                      type="button"
                      onClick={() => useProfile(profile)}
                    >
                      Register
                    </button>
                  ) : (
                    <span className="rider-account-disabled-note">
                      <CircleAlert size={13} /> Off
                    </span>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <p className="team-security-note">
        Riders sign in with the email and password you create
        here. They can only view deliveries assigned to their
        own rider profile; customer contact and delivery address
        are shown only for those assignments.
      </p>
    </div>
  );
}