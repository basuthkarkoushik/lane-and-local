const express = require('express');
const cors = require('cors');
const { AppError } = require('./logic/validation');
const { mutate } = require('./routes/helpers');
const store = require('./data/store');
const { access } = require('./middleware/access');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', access);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/riders', require('./routes/riders'));
app.use('/api/rider', require('./routes/rider-portal'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/simulator', require('./routes/simulator'));
app.use('/api/radius', require('./routes/radius'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/history', require('./routes/history'));
app.use('/api/export', require('./routes/export'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 5000;

store.init().then((backend) => {
  // Make sure alerts match the saved data on every start
  mutate(null, () => null);
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT} (storage: ${backend === 'postgres' ? 'PostgreSQL' : 'db.json file'})`));
}).catch((err) => {
  console.error('Could not start the server:', err.message);
  process.exit(1);
});

// Finish writing to the database before the process stops (redeploys, Ctrl+C)
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => store.flush().finally(() => process.exit(0)));
}