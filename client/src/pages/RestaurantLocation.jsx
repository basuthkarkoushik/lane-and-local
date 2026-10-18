import { useEffect, useState } from 'react';
import {
  MapPin,
  LocateFixed,
  RefreshCw,
  CheckCircle2,
  Save,
} from 'lucide-react';

import { api } from '../api';
import { ErrorBox, Loading } from '../components/Feedback';

export default function RestaurantLocation() {
  const [location, setLocation] = useState(null);
  const [form, setForm] = useState({
    latitude: '',
    longitude: '',
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function reload() {
    setLoading(true);
    setError('');

    try {
      const result = await api.restaurantLocation();

      setLocation(result);
      setForm({
        latitude:
          result.latitude == null ? '' : String(result.latitude),
        longitude:
          result.longitude == null ? '' : String(result.longitude),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      setError('This browser does not support location access.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        });

        setMessage(
          'Location detected. Review the coordinates, then click Save location.'
        );
        setBusy(false);
      },
      (geoError) => {
        if (geoError.code === 1) {
          setError(
            'Location permission was denied. Allow location access in your browser and try again.'
          );
        } else if (geoError.code === 2) {
          setError(
            'Your device could not determine its location. Check device location services or enter coordinates from a map.'
          );
        } else {
          setError(
            'Location request timed out. Please try again.'
          );
        }

        setBusy(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  }

  async function saveLocation(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (
      form.latitude.trim() === '' ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      setError('Enter a valid latitude between -90 and 90.');
      setBusy(false);
      return;
    }

    if (
      form.longitude.trim() === '' ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      setError('Enter a valid longitude between -180 and 180.');
      setBusy(false);
      return;
    }

    try {
      const saved = await api.saveRestaurantLocation({
        latitude,
        longitude,
      });

      setLocation(saved);
      setForm({
        latitude: String(saved.latitude),
        longitude: String(saved.longitude),
      });

      setMessage(
        'Restaurant location saved successfully.'
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !location) {
    return <Loading text="Loading restaurant location…" />;
  }

  const configured =
    location?.latitude != null &&
    location?.longitude != null;

  return (
    <div className="restaurant-location-settings">
      {error && (
        <div style={{ marginBottom: 12 }}>
          <ErrorBox message={error} />
        </div>
      )}

      {message && (
        <div
          className="success-box"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}

      <section className="card" style={{ maxWidth: 820 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              display: 'grid',
              placeItems: 'center',
              background: '#e9f0e1',
              color: '#244632',
            }}
          >
            <MapPin size={21} />
          </span>

          <div>
            <div className="card-title" style={{ marginBottom: 3 }}>
              Restaurant location
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              Set the restaurant's map point once for automatic
              customer distance estimates.
            </p>
          </div>
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.65 }}>
          Use this feature from a device at the restaurant, or
          enter the restaurant's latitude and longitude from a
          map. Customers' location will be compared against
          these coordinates.
        </p>

        <div
          style={{
            padding: 14,
            border: '1px solid #e7e4da',
            borderRadius: 14,
            background: '#f8f7f1',
            margin: '16px 0',
          }}
        >
          <strong>
            {location?.restaurant_name || 'Your restaurant'}
          </strong>

          <div className="muted small" style={{ marginTop: 8 }}>
            {configured
              ? `Saved coordinates: ${Number(
                  location.latitude
                ).toFixed(6)}, ${Number(
                  location.longitude
                ).toFixed(6)}`
              : 'No location saved yet. Save the restaurant coordinates to enable automatic distance calculation.'}
          </div>
        </div>

        <form onSubmit={saveLocation}>
          <div className="commerce-form-grid">
            <label className="commerce-field">
              <span>Restaurant latitude</span>
              <input
                type="number"
                min="-90"
                max="90"
                step="any"
                required
                value={form.latitude}
                onChange={(event) =>
                  setForm((old) => ({
                    ...old,
                    latitude: event.target.value,
                  }))
                }
                placeholder="e.g. 17.000000"
              />
            </label>

            <label className="commerce-field">
              <span>Restaurant longitude</span>
              <input
                type="number"
                min="-180"
                max="180"
                step="any"
                required
                value={form.longitude}
                onChange={(event) =>
                  setForm((old) => ({
                    ...old,
                    longitude: event.target.value,
                  }))
                }
                placeholder="e.g. 78.000000"
              />
            </label>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 12,
            }}
          >
            <button
              className="btn"
              type="button"
              onClick={useDeviceLocation}
              disabled={busy}
            >
              <LocateFixed size={15} />
              Use this device's location
            </button>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy}
            >
              <Save size={15} />
              {busy ? 'Saving…' : 'Save location'}
            </button>

            <button
              className="btn"
              type="button"
              onClick={reload}
              disabled={busy}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </form>

        <p className="muted small" style={{ marginTop: 14 }}>
          Distance is calculated as an approximate straight-line
          distance, not a driving route.
        </p>
      </section>
    </div>
  );
}