import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  UserPlus,
  Users,
  Trash2,
  RefreshCw,
  Bike,
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import { ErrorBox, Loading } from '../components/Feedback';
import { api } from '../api';
import { useAuth } from '../auth';
import RiderRegistration from './RiderRegistration';

export default function TeamManagement() {
  const { restaurantName } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab =
    searchParams.get('tab') === 'riders'
      ? 'riders'
      : 'dispatchers';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  async function reload() {
    setLoading(true);
    setError('');

    try {
      setData(await api.dispatchers());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function chooseTab(tab) {
    setError('');
    setMessage('');

    setSearchParams(
      tab === 'riders' ? { tab: 'riders' } : {}
    );
  }

  async function add(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      await api.createDispatcher(form);

      setForm({
        name: '',
        email: '',
        password: '',
      });

      setMessage(
        'Dispatcher account created. Share the sign-in details securely with your team member.'
      );

      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    const confirmed = window.confirm(
      'Deactivate this dispatcher account? They will no longer be able to sign in.'
    );

    if (!confirmed) return;

    setError('');
    setMessage('');

    try {
      await api.removeDispatcher(id);

      setMessage(
        'Dispatcher access has been deactivated.'
      );

      await reload();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="team-page">
      <PageHeader
        title="Team & Access"
        subtitle={
          restaurantName
            ? `${restaurantName} · manage dispatcher and rider accounts.`
            : 'Manage dispatcher and rider access.'
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

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Team access sections"
        className="row"
        style={{
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'dispatchers'}
          className={`btn ${
            activeTab === 'dispatchers'
              ? 'btn-primary'
              : ''
          }`}
          onClick={() => chooseTab('dispatchers')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Users size={16} />
          Dispatchers
          <span>
            ({data?.dispatchers?.length ?? '—'})
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'riders'}
          className={`btn ${
            activeTab === 'riders' ? 'btn-primary' : ''
          }`}
          onClick={() => chooseTab('riders')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Bike size={16} />
          Rider Registration
        </button>
      </div>

      {/* Dispatcher tab */}
      {activeTab === 'dispatchers' && (
        <>
          {error && (
            <div className="team-feedback">
              <ErrorBox message={error} />
            </div>
          )}

          {message && (
            <div className="success-box team-feedback">
              {message}
            </div>
          )}

          <div className="team-grid">
            <section className="card team-card">
              <div className="team-title">
                <span>
                  <UserPlus size={18} />
                </span>

                <div>
                  <h2>Add a dispatcher</h2>
                  <p>
                    Create a staff login for your restaurant.
                  </p>
                </div>
              </div>

              <form className="team-form" onSubmit={add}>
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
                    maxLength={80}
                    required
                    placeholder="Dispatcher name"
                  />
                </label>

                <label>
                  <span>Email</span>

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
                    placeholder="team@example.com"
                  />
                </label>

                <label>
                  <span>Temporary password</span>

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
                  />
                </label>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy}
                >
                  {busy
                    ? 'Creating…'
                    : 'Create dispatcher'}
                </button>
              </form>
            </section>

            <section className="card team-card">
              <div className="team-title">
                <span>
                  <Users size={18} />
                </span>

                <div>
                  <h2>Dispatcher access</h2>
                  <p>
                    {data?.dispatchers?.length || 0}{' '}
                    accounts assigned to your restaurant.
                  </p>
                </div>
              </div>

              {loading && !data ? (
                <Loading text="Loading your team…" />
              ) : data?.dispatchers?.length ? (
                <div className="team-list">
                  {data.dispatchers.map((person) => (
                    <div
                      className="team-member"
                      key={person.id}
                    >
                      <span className="team-avatar">
                        {person.name
                          .split(' ')
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>

                      <span className="team-member-details">
                        <strong>{person.name}</strong>
                        <small>{person.email}</small>
                        <small>
                          {person.active
                            ? 'Active'
                            : 'Deactivated'}
                        </small>
                      </span>

                      <button
                        className="icon-btn team-remove"
                        type="button"
                        onClick={() => remove(person.id)}
                        title="Deactivate dispatcher"
                        aria-label={`Deactivate ${person.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="team-empty">
                  <Users size={24} />
                  <p>No dispatchers yet.</p>
                </div>
              )}
            </section>
          </div>

          <p className="team-security-note">
            Each dispatcher can only access this restaurant’s
            orders, riders and alerts. Owners can manage their
            own team.
          </p>
        </>
      )}

      {/* Rider Registration tab */}
      {activeTab === 'riders' && (
        <RiderRegistration embedded />
      )}
    </div>
  );
}