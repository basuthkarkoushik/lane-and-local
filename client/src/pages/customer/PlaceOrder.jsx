import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Check, Clock3, Leaf, MapPin, Minus, Plus, Search,
  ShoppingBag, Sparkles, Star, Wallet,
} from 'lucide-react';
import { useAuth } from '../../auth';
import { api } from '../../api';
import { money } from '../../utils/format';
import { ErrorBox, Loading } from '../../components/Feedback';

function hasCoordinates(place) {
  return Boolean(
    place &&
    place.latitude !== null &&
    place.latitude !== undefined &&
    place.latitude !== '' &&
    place.longitude !== null &&
    place.longitude !== undefined &&
    place.longitude !== '' &&
    Number.isFinite(Number(place.latitude)) &&
    Number.isFinite(Number(place.longitude)) &&
    Number(place.latitude) >= -90 &&
    Number(place.latitude) <= 90 &&
    Number(place.longitude) >= -180 &&
    Number(place.longitude) <= 180
  );
}

// Approximate straight-line distance, in kilometres.
function distanceBetweenKm(origin, destination) {
  if (!origin || !hasCoordinates(destination)) return null;

  const lat1 = Number(origin.latitude);
  const lon1 = Number(origin.longitude);
  const lat2 = Number(destination.latitude);
  const lon2 = Number(destination.longitude);

  if (!Number.isFinite(lat1) || !Number.isFinite(lon1)) {
    return null;
  }

  const radians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);

  const a = Math.min(1, Math.max(0,
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
    Math.cos(radians(lat2)) *
    Math.sin(dLon / 2) ** 2
  ));

  const km =
    6371 * 2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(km * 10) / 10;
}

const PAYMENT_OPTIONS = [
  {
    id: 'demo_upi',
    title: 'UPI / online',
    detail: 'Simulated payment · no real charge',
    icon: Wallet,
  },
  {
    id: 'cod',
    title: 'Cash on delivery',
    detail: 'Pay when your order arrives',
    icon: ShoppingBag,
  },
];

export default function PlaceOrder() {
  const navigate = useNavigate();
  const { name, role, isAuthenticated } = useAuth();

  const [restaurants, setRestaurants] = useState([]);
  const [selectedId, setSelectedId] = useState(
    () => localStorage.getItem('ll_selected_restaurant') ||
      'rest-green-table'
  );

  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ll_cart') || '{}');
    } catch {
      return {};
    }
  });

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [membership, setMembership] = useState(null);

  const [form, setForm] = useState(() => {
    const defaults = {
      delivery_address: '',
      phone: '',
      deadline_minutes: '35',
    };

    try {
      const saved = JSON.parse(
        sessionStorage.getItem('ll_checkout_form') || '{}'
      );

      // Remove the old manually entered distance, if it was saved.
      delete saved.distance_km;

      return { ...defaults, ...saved };
    } catch {
      return defaults;
    }
  });

  const [customerLocation, setCustomerLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('loading');
  const [locationError, setLocationError] = useState('');

  const [paymentMethod, setPaymentMethod] = useState('demo_upi');
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let live = true;

    Promise.all([
      api.customerRestaurants(),
      role === 'customer' && isAuthenticated
        ? api.customerPremium()
        : Promise.resolve(null),
    ])
      .then(([restaurantData, premiumData]) => {
        if (!live) return;

        setRestaurants(restaurantData);
        setMembership(premiumData);

        const savedId = localStorage.getItem(
          'll_selected_restaurant'
        );

        const first =
          restaurantData.find((item) => item.id === savedId) ||
          restaurantData[0];

        if (first) setSelectedId(first.id);
      })
      .catch((e) => {
        if (live) setErr(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, []);

  const restaurant =
    restaurants.find((r) => r.id === selectedId) || null;

  const restaurantHasCoordinates = hasCoordinates(restaurant);

  const distanceKm = distanceBetweenKm(
    customerLocation,
    restaurant
  );

  // Ask the browser for the customer's current location.
  function requestCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError(
        'Your browser does not support location access.'
      );
      return;
    }

    setLocationStatus('loading');
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        setLocationStatus('ready');
        setLocationError('');
      },
      (geoError) => {
        setLocationStatus('error');

        if (geoError.code === 1) {
          setLocationError(
            'Location access was denied. Allow location access in your browser, then try again.'
          );
        } else if (geoError.code === 2) {
          setLocationError(
            'Your location could not be determined. Check your device location settings.'
          );
        } else {
          setLocationError(
            'Location request timed out. Please try again.'
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  }

  // Automatically request location when the page opens.
  useEffect(() => {
    requestCurrentLocation();
  }, []);

  useEffect(() => {
    localStorage.setItem('ll_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (selectedId) {
      localStorage.setItem('ll_selected_restaurant', selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    sessionStorage.setItem(
      'll_checkout_form',
      JSON.stringify(form)
    );
  }, [form]);

  const cartItems = useMemo(() => {
    if (!restaurant) return [];

    return restaurant.menu
      .filter((item) => Number(cart[item.id]) > 0)
      .map((item) => ({
        ...item,
        quantity: Number(cart[item.id]),
        subtotal_inr:
          item.price_inr * Number(cart[item.id]),
      }));
  }, [restaurant, cart]);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.subtotal_inr,
    0
  );

  const deliveryFee = estimate?.delivery_fee_inr ?? 30;
  const total = subtotal + deliveryFee;

  // Ask the server for an estimate using GPS coordinates.
  // The server calculates the distance independently.
  useEffect(() => {
    if (
      !subtotal ||
      distanceKm === null ||
      !restaurantHasCoordinates ||
      locationStatus !== 'ready' ||
      !customerLocation
    ) {
      setEstimate(null);
      return undefined;
    }

    const timer = setTimeout(() => {
      api.customerEstimate({
        restaurant_id: selectedId,
        basket_inr: subtotal,
        customer_latitude: customerLocation.latitude,
        customer_longitude: customerLocation.longitude,
        deadline_minutes: form.deadline_minutes,
      })
        .then(setEstimate)
        .catch((e) => {
          setEstimate({
            valid: false,
            errors: [e.message],
          });
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [
    subtotal,
    selectedId,
    distanceKm,
    restaurantHasCoordinates,
    locationStatus,
    customerLocation,
    form.deadline_minutes,
  ]);

  const setField = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const updateQty = (itemId, delta) =>
    setCart((current) => {
      const nextQty =
        (Number(current[itemId]) || 0) + delta;

      const next = { ...current };

      if (nextQty <= 0) {
        delete next[itemId];
      } else {
        next[itemId] = Math.min(20, nextQty);
      }

      return next;
    });

  function chooseRestaurant(nextRestaurant) {
    setSelectedId(nextRestaurant.id);
    setCart({});
    setCategory('All');
  }

  const categories = [
    'All',
    ...new Set(
      (restaurant?.menu || []).map((item) => item.category)
    ),
  ];

  const visibleMenu = (restaurant?.menu || []).filter(
    (item) => {
      const term = search.trim().toLowerCase();

      return (
        (category === 'All' || item.category === category) &&
        (
          !term ||
          item.name.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term)
        )
      );
    }
  );

  async function submit(event) {
    event.preventDefault();
    setErr(null);

    if (role !== 'customer' || !isAuthenticated) {
      localStorage.setItem('ll_cart', JSON.stringify(cart));
      localStorage.setItem(
        'll_selected_restaurant',
        selectedId
      );

      navigate('/login', {
        state: { from: '/my-orders/new' },
      });

      return;
    }

    if (!restaurant) {
      return setErr('Choose a restaurant first.');
    }

    if (!cartItems.length) {
      return setErr(
        'Add at least one menu item to your bag.'
      );
    }

    if (locationStatus !== 'ready' || !customerLocation) {
      return setErr(
        'Allow location access so we can calculate your distance automatically.'
      );
    }

    if (!restaurantHasCoordinates || distanceKm === null) {
      return setErr(
        'This restaurant has not configured its map location yet. Ask the owner to set it under Settings → Restaurant location.'
      );
    }

    if (!form.delivery_address.trim()) {
      return setErr('Enter your delivery address.');
    }

    if (
      !/^\d{10}$/.test(
        form.phone.replace(/\D/g, '').slice(-10)
      )
    ) {
      return setErr('Enter a valid 10-digit mobile number.');
    }

    if (
      paymentMethod === 'demo_upi' &&
      !window.confirm(
        'Demo online payment: simulate a successful payment? No real money will be charged.'
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const order = await api.customerPlace({
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name,
        items: cartItems.map((item) => ({
          item_id: item.id,
          quantity: item.quantity,
        })),
        basket_inr: subtotal,

        // Send coordinates; the backend calculates distance.
        customer_latitude: customerLocation.latitude,
        customer_longitude: customerLocation.longitude,

        deadline_minutes: Number(form.deadline_minutes),
        delivery_address: form.delivery_address.trim(),
        phone: form.phone,
        payment_method: paymentMethod,
      });

      setCart({});
      localStorage.removeItem('ll_cart');
      sessionStorage.removeItem('ll_checkout_form');

      navigate(
        `/my-orders?placed=${encodeURIComponent(order.id)}`
      );
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Loading text="Finding your neighbourhood favourites..." />
    );
  }

  return (
    <div className="shopper-page">
      <section className="shopper-hero">
        <div className="shopper-kicker">
          <Leaf size={14} /> GOOD FOOD, A LITTLE CLOSER
        </div>

        <div className="shopper-hero-row">
          <div>
            <h1>
              {name
                ? `What sounds good, ${name.split(' ')[0]}?`
                : 'Something lovely, nearby.'}
            </h1>
          </div>

          <div className="shopper-hero-badge">
            <ShoppingBag size={18} />
            <span>
              <strong>
                {cartItems.reduce(
                  (n, item) => n + item.quantity,
                  0
                )} items
              </strong>
              <small>in your bag</small>
            </span>
          </div>
        </div>
      </section>

      {err && (
        <div className="shopper-error">
          <ErrorBox message={err} />
        </div>
      )}

      {isAuthenticated &&
        role === 'customer' &&
        membership &&
        !membership.is_premium && (
          <section className="premium-nudge">
            <div className="premium-nudge-icon">
              <Sparkles size={20} />
            </div>

            <div className="premium-nudge-copy">
              <strong>Meet Lane &amp; Local Plus</strong>
              <span>
                Cancel an accepted order until food preparation begins.
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigate('/premium')}
            >
              Explore Plus <ArrowRight size={15} />
            </button>
          </section>
        )}

      {isAuthenticated &&
        role === 'customer' &&
        membership?.is_premium && (
          <section className="premium-active-strip">
            <Sparkles size={16} />
            <span>
              You’re on <strong>Lane &amp; Local Plus</strong> —
              cancellation is available until food preparation begins.
            </span>
          </section>
        )}

      <section className="shopper-section">
        <div className="shopper-section-heading">
          <div>
            <div>
              <h2>Choose a restaurant</h2>
            </div>
          </div>
        </div>

        <div className="restaurant-grid">
          {restaurants.map((item) => {
            const itemDistance = distanceBetweenKm(
              customerLocation,
              item
            );

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => chooseRestaurant(item)}
                className={`restaurant-card ${
                  selectedId === item.id ? 'selected' : ''
                }`}
              >
                <div className={`restaurant-art art-${item.accent}`}>
                  <span className="restaurant-emoji">
                    {item.emoji}
                  </span>

                  <span className="restaurant-rating">
                    <Star size={12} fill="currentColor" />
                    {item.rating}
                  </span>

                  {selectedId === item.id && (
                    <span className="restaurant-selected">
                      <Check size={13} />
                    </span>
                  )}
                </div>

                <div className="restaurant-copy">
                  <strong>{item.name}</strong>
                  <span>{item.cuisine}</span>

                  <div>
                    <Clock3 size={13} />
                    {item.eta}
                    <i />
                    <MapPin size={13} />

                    {itemDistance === null
                      ? locationStatus === 'loading'
                        ? 'Locating…'
                        : 'Distance unavailable'
                      : `${itemDistance.toFixed(1)} km`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {restaurant && (
        <section className="shopper-section menu-and-cart">
          <div className="menu-column">
            <div className="shopper-section-heading">
              <div>
                <div>
                  <h2>{restaurant.name}</h2>
                </div>
              </div>
            </div>

            <div className="menu-tools">
              <div className="menu-search">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find something delicious"
                />
              </div>
            </div>

            <div className="menu-categories">
              {categories.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={category === value ? 'active' : ''}
                  onClick={() => setCategory(value)}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="menu-grid">
              {visibleMenu.map((item) => {
                const qty = Number(cart[item.id]) || 0;

                return (
                  <article
                    className="menu-item-card"
                    key={item.id}
                  >
                    <div
                      className={`menu-item-art art-${restaurant.accent}`}
                    >
                      <span>{item.emoji}</span>

                      {item.vegetarian && (
                        <span
                          className="veg-mark"
                          title="Vegetarian"
                        >
                          ●
                        </span>
                      )}
                    </div>

                    <div className="menu-item-info">
                      <div className="menu-item-title">
                        <strong>{item.name}</strong>
                        <span>{money(item.price_inr)}</span>
                      </div>

                      <p>{item.description}</p>

                      <div className="menu-item-bottom">
                        <small>{item.category}</small>

                        {qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, 1)}
                          >
                            <Plus size={14} /> Add
                          </button>
                        ) : (
                          <div className="quantity-control">
                            <button
                              type="button"
                              aria-label={`Remove one ${item.name}`}
                              onClick={() =>
                                updateQty(item.id, -1)
                              }
                            >
                              <Minus size={13} />
                            </button>

                            <strong>{qty}</strong>

                            <button
                              type="button"
                              aria-label={`Add one ${item.name}`}
                              onClick={() =>
                                updateQty(item.id, 1)
                              }
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}

              {visibleMenu.length === 0 && (
                <div className="menu-empty">
                  No items match that search.
                </div>
              )}
            </div>
          </div>

          <aside className="checkout-column">
            <form className="checkout-card" onSubmit={submit}>
              <div className="checkout-heading">
                <div>
                  <h2>Your bag</h2>
                </div>

                <span className="checkout-count">
                  {cartItems.reduce(
                    (n, item) => n + item.quantity,
                    0
                  )} items
                </span>
              </div>

              {cartItems.length === 0 ? (
                <div className="empty-bag">
                  <span>
                    <ShoppingBag size={24} />
                  </span>
                  <strong>Your bag is empty.</strong>
                </div>
              ) : (
                <div className="bag-items">
                  {cartItems.map((item) => (
                    <div className="bag-item" key={item.id}>
                      <div className="bag-item-emoji">
                        {item.emoji}
                      </div>

                      <div className="bag-item-copy">
                        <strong>{item.name}</strong>
                        <small>
                          {money(item.price_inr)} each
                        </small>

                        <div className="quantity-control compact">
                          <button
                            type="button"
                            aria-label={`Remove one ${item.name}`}
                            onClick={() =>
                              updateQty(item.id, -1)
                            }
                          >
                            <Minus size={12} />
                          </button>

                          <strong>{item.quantity}</strong>

                          <button
                            type="button"
                            aria-label={`Add one ${item.name}`}
                            onClick={() =>
                              updateQty(item.id, 1)
                            }
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                      <strong className="bag-line-total">
                        {money(item.subtotal_inr)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}

              <div className="checkout-divider" />

              <div className="price-breakdown">
                <div>
                  <span>Items subtotal</span>
                  <strong>{money(subtotal)}</strong>
                </div>

                <div>
                  <span>Neighbourhood delivery</span>
                  <strong>
                    {money(cartItems.length ? deliveryFee : 0)}
                  </strong>
                </div>

                <div className="price-total">
                  <span>Total to pay</span>
                  <strong>
                    {money(cartItems.length ? total : 0)}
                  </strong>
                </div>

                <small>
                  Prices shown in INR. The demo does not add a
                  separate tax line.
                </small>
              </div>

              <div className="checkout-divider" />

              <div className="checkout-subheading">
                <MapPin size={16} />
                <strong>Where should we bring it?</strong>
              </div>

              <label className="commerce-field">
                <span>Delivery address</span>
                <textarea
                  value={form.delivery_address}
                  onChange={setField('delivery_address')}
                  placeholder="House / flat, street, area and landmark"
                  rows={2}
                  maxLength={240}
                  required={
                    isAuthenticated && role === 'customer'
                  }
                />
              </label>

              

              {locationStatus !== 'ready' && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={requestCurrentLocation}
                  style={{ marginBottom: 12 }}
                >
                  <MapPin size={14} />
                  Use my current location
                </button>
              )}

              <p
                className="muted small"
                style={{ marginTop: -4, marginBottom: 12 }}
              >
                Enter the address where you want this order delivered.
                For the best estimate, it should match your current
                location.
              </p>

              <label className="commerce-field">
                <span>Mobile number</span>
                <input
                  inputMode="tel"
                  value={form.phone}
                  onChange={setField('phone')}
                  placeholder="10-digit number"
                  maxLength={14}
                  required={
                    isAuthenticated && role === 'customer'
                  }
                />
              </label>

              <label className="commerce-field">
                <span>Delivery time preference</span>
                <select
                  value={form.deadline_minutes}
                  onChange={setField('deadline_minutes')}
                >
                  <option value="25">Around 25 minutes</option>
                  <option value="35">Around 35 minutes</option>
                  <option value="45">Around 45 minutes</option>
                  <option value="60">Around 60 minutes</option>
                </select>
              </label>

              {estimate?.valid && (
                <div
                  className={`estimate-note ${
                    estimate.within_area &&
                    estimate.can_meet_time
                      ? 'good'
                      : 'caution'
                  }`}
                >
                  <Clock3 size={15} />
                  <span>{estimate.message}</span>
                </div>
              )}

              {estimate && !estimate.valid && (
                <div className="estimate-note caution">
                  {estimate.errors.join(' ')}
                </div>
              )}

              <div className="checkout-divider" />

              <div className="checkout-subheading">
                <Wallet size={16} />
                <strong>How would you like to pay?</strong>
              </div>

              <div className="payment-options">
                {PAYMENT_OPTIONS.map((option) => {
                  const Icon = option.icon;

                  return (
                    <label
                      className={`payment-option ${
                        paymentMethod === option.id
                          ? 'selected'
                          : ''
                      }`}
                      key={option.id}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value={option.id}
                        checked={paymentMethod === option.id}
                        onChange={() =>
                          setPaymentMethod(option.id)
                        }
                      />

                      <span className="payment-icon">
                        <Icon size={17} />
                      </span>

                      <span className="payment-copy">
                        <strong>{option.title}</strong>
                        <small>{option.detail}</small>
                      </span>

                      {paymentMethod === option.id && (
                        <Check
                          size={16}
                          className="payment-check"
                        />
                      )}
                    </label>
                  );
                })}
              </div>

              {paymentMethod === 'demo_upi' && (
                <p className="demo-payment-note">
                  Demo checkout only. Selecting online payment
                  simulates success; no card details are requested
                  and no real money is charged.
                </p>
              )}

              <button
                className="place-order-button"
                disabled={
                  busy ||
                  cartItems.length === 0 ||
                  locationStatus !== 'ready' ||
                  distanceKm === null ||
                  !estimate?.valid
                }
                type="submit"
              >
                {busy
                  ? 'Placing your order…'
                  : `Place order · ${money(total)}`}
                <ArrowRight size={16} />
              </button>

              <p className="checkout-terms">
                Delivery time is an estimate. Online payment is
                simulated in this demo.
              </p>
            </form>
          </aside>
        </section>
      )}

      <footer className="shopper-footer">
        <span>
          <Leaf size={15} /> Lane &amp; Local
        </span>
      </footer>
    </div>
  );
}