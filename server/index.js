const express = require('express');
const cors = require('cors');
const path = require('path');

const { AppError } = require('./logic/validation');
const { mutate } = require('./routes/helpers');
const store = require('./data/store');
const { access } = require('./middleware/access');

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// API authentication and access middleware
app.use('/api', access);

// API routes
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

// Unknown API endpoints must return an API 404,
// not the React website.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Production frontend location.
// server/index.js -> ../client/dist
const clientDist = path.join(__dirname, '..', 'client', 'dist');

// Serve compiled React, CSS, images and other assets.
app.use(express.static(clientDist));

// React Router fallback.
// Express 5 requires a named wildcard.
app.get('/{*splat}', (req, res, next) => {
  res.sendFile(
    path.join(clientDist, 'index.html'),
    (error) => {
      if (error) next(error);
    }
  );
});

// Central error handler
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.message,
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON body',
    });
  }

  console.error(err);

  res.status(500).json({
    error: 'Something went wrong on the server',
  });
});

const PORT = process.env.PORT || 5000;

store
  .init()
  .then((backend) => {
    // Refresh alert state after loading the database.
    mutate(null, () => null);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(
        `Server running on port ${PORT} ` +
        `(storage: ${
          backend === 'postgres'
            ? 'PostgreSQL'
            : 'db.json file'
        })`
      );
    });
  })
  .catch((err) => {
    console.error(
      'Could not start the server:',
      err.message
    );
    process.exit(1);
  });

// Flush database writes during shutdown.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    store
      .flush()
      .finally(() => process.exit(0));
  });
}