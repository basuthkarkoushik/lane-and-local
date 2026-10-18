// Demonstration neighbourhood restaurant catalogue. Menu prices are sample data.
const RESTAURANTS = [
  {
    id: 'rest-green-table',
    name: 'Green Table',
    tagline: 'Fresh bowls, bright days.',
    cuisine: 'Fresh & wholesome',
    eta: '20–30 min',
    rating: '4.8',
    distance_km: 2.0,
    emoji: '🥗',
    accent: 'sage',
    menu: [
      { id: 'gt-grain-bowl', name: 'Roasted Grain Bowl', description: 'Warm grains, seasonal vegetables, herb dressing.', price_inr: 249, emoji: '🥗', category: 'Bowls', vegetarian: true },
      { id: 'gt-paneer-bowl', name: 'Paneer Power Bowl', description: 'Charred paneer, greens, rice and mint yoghurt.', price_inr: 229, emoji: '🥙', category: 'Bowls', vegetarian: true },
      { id: 'gt-avocado-toast', name: 'Avocado Toast', description: 'Sourdough, avocado, seeds and lemon.', price_inr: 189, emoji: '🥑', category: 'Small plates', vegetarian: true },
      { id: 'gt-lemon-cooler', name: 'Mint Lemon Cooler', description: 'Fresh lime, mint and a little fizz.', price_inr: 89, emoji: '🍋', category: 'Drinks', vegetarian: true },
    ],
  },
  {
    id: 'rest-little-tiffin',
    name: 'Little Tiffin Co.',
    tagline: 'Comfort food, made nearby.',
    cuisine: 'South Indian comfort',
    eta: '20–35 min',
    rating: '4.7',
    distance_km: 2.4,
    emoji: '🥘',
    accent: 'peach',
    menu: [
      { id: 'lt-mini-idli', name: 'Podi Mini Idli', description: 'Soft mini idlis tossed in house podi and ghee.', price_inr: 129, emoji: '🍘', category: 'Breakfast & snacks', vegetarian: true },
      { id: 'lt-masala-dosa', name: 'Classic Masala Dosa', description: 'Crisp dosa, potato masala, chutneys and sambar.', price_inr: 159, emoji: '🥞', category: 'Mains', vegetarian: true },
      { id: 'lt-paneer-rice', name: 'Paneer Rice Bowl', description: 'Spiced rice, paneer and cooling raita.', price_inr: 199, emoji: '🍚', category: 'Mains', vegetarian: true },
      { id: 'lt-filter-coffee', name: 'Filter Coffee', description: 'Strong South Indian filter coffee.', price_inr: 59, emoji: '☕', category: 'Drinks', vegetarian: true },
    ],
  },
  {
    id: 'rest-basil-brick',
    name: 'Basil & Brick',
    tagline: 'Slow-made, oven-warm.',
    cuisine: 'Pizza & Italian',
    eta: '25–40 min',
    rating: '4.6',
    distance_km: 2.8,
    emoji: '🍕',
    accent: 'coral',
    menu: [
      { id: 'bb-margherita', name: 'Garden Margherita', description: 'Tomato, mozzarella, basil and olive oil.', price_inr: 299, emoji: '🍕', category: 'Pizza', vegetarian: true },
      { id: 'bb-roasted-sandwich', name: 'Roasted Veg Sandwich', description: 'Roasted vegetables, pesto and toasted bread.', price_inr: 179, emoji: '🥪', category: 'Small plates', vegetarian: true },
      { id: 'bb-garlic-knots', name: 'Garlic Knots', description: 'Oven-baked dough knots with garlic herb butter.', price_inr: 129, emoji: '🥖', category: 'Small plates', vegetarian: true },
      { id: 'bb-peach-iced-tea', name: 'Peach Iced Tea', description: 'Black tea, peach and fresh lemon.', price_inr: 99, emoji: '🧋', category: 'Drinks', vegetarian: true },
    ],
  },
  {
    id: 'rest-mango-street',
    name: 'Mango Street Kitchen',
    tagline: 'Big flavour, local heart.',
    cuisine: 'Indian favourites',
    eta: '25–40 min',
    rating: '4.7',
    distance_km: 2.6,
    emoji: '🍛',
    accent: 'lavender',
    menu: [
      { id: 'ms-paneer-rice', name: 'Paneer Rice Plate', description: 'Paneer curry, fragrant rice and salad.', price_inr: 229, emoji: '🍛', category: 'Mains', vegetarian: true },
      { id: 'ms-chicken-meal', name: 'Home-style Chicken Meal', description: 'Chicken curry, rice and a side of raita.', price_inr: 269, emoji: '🍗', category: 'Mains', vegetarian: false },
      { id: 'ms-chole-bowl', name: 'Chole & Rice Bowl', description: 'Slow-cooked chickpeas, rice and onions.', price_inr: 179, emoji: '🥘', category: 'Mains', vegetarian: true },
      { id: 'ms-mango-lassi', name: 'Mango Lassi', description: 'Creamy yoghurt blended with mango.', price_inr: 99, emoji: '🥭', category: 'Drinks', vegetarian: true },
    ],
  },
];

function listRestaurants(db) {
  const source = db && Array.isArray(db.restaurants) && db.restaurants.length ? db.restaurants : RESTAURANTS;
  return source.filter((r) => r.active !== false).map((restaurant) => ({ ...restaurant, menu: (restaurant.menu || []).filter((item) => item.active !== false && item.availability !== 'paused').map((item) => ({ ...item })) }));
}

function findRestaurant(id, db) {
  const source = db && Array.isArray(db.restaurants) && db.restaurants.length ? db.restaurants : RESTAURANTS;
  return source.find((restaurant) => restaurant.id === String(id) && restaurant.active !== false) || null;
}

function findMenuItem(restaurantId, itemId, db) {
  const restaurant = findRestaurant(restaurantId, db);
  return restaurant?.menu.find((item) => item.id === String(itemId) && item.active !== false && item.availability !== 'paused') || null;
}

module.exports = { RESTAURANTS, listRestaurants, findRestaurant, findMenuItem };
