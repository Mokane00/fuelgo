// ================================================
// FuelGO — server.js
// Description: Main Express application entry point
// Author: FuelGO Dev
// ================================================
require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const http        = require('http');
const { Server }  = require('socket.io');
const passport    = require('passport');
const initDB      = require('../database/initDB');
const requestLogger = require('./middleware/requestLogger');
const { generalLimiter, authLimiter, paymentLimiter } = require('./middleware/rateLimiter');

const app    = express();
const server = http.createServer(app);

// ── Socket.io (real-time pump status) ───────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
// Expose io globally so routes can emit events
app.set('io', io);
io.on('connection', socket => {
  // Let employee dashboards subscribe to a station room
  socket.on('join_station', stationId => socket.join(`station_${stationId}`));
});

// ── Security ────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "cdnjs.cloudflare.com", "unpkg.com", "cdn.jsdelivr.net", "js.stripe.com", "maps.googleapis.com", "'unsafe-inline'"],
      // Allow inline event handlers (onclick, oninput, etc.) throughout the app
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      fontSrc:       ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
      imgSrc:        ["'self'", "data:", "blob:", "*.openstreetmap.org", "*.tile.openstreetmap.org", "res.cloudinary.com", "*.googleusercontent.com", "maps.googleapis.com", "maps.gstatic.com", "*.ggpht.com"],
      connectSrc:    ["'self'", "cdn.jsdelivr.net", "api.stripe.com", "*.openstreetmap.org", "maps.googleapis.com", "maps.gstatic.com", "ws://localhost:5001", "api.openweathermap.org", "openexchangerates.org", "ipapi.co", "fcm.googleapis.com", "api.what3words.com", "api.mapbox.com", "events.mapbox.com", "www.carboninterface.com"],
      frameSrc:      ["'self'", "js.stripe.com"],
    },
  },
}));

const corsOptions = process.env.NODE_ENV === 'development'
  ? { origin: true, methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-Refreshed-Token'], exposedHeaders: ['X-Refreshed-Token'] }
  : { origin: [
      process.env.FRONTEND_URL || 'http://localhost:5000',
      'http://localhost:5001',
      'http://127.0.0.1:5001',
      'http://127.0.0.1:5500',
      'null', // file:// access during development
    ], methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-Refreshed-Token'], exposedHeaders: ['X-Refreshed-Token'] };
app.use(cors(corsOptions));

// ── Passport (OAuth) ─────────────────────────────
app.use(passport.initialize());

// ── Performance ─────────────────────────────────
app.use(compression());

// ── Parsing ──────────────────────────────────────
app.use(express.json());

// ── Request logging ──────────────────────────────
app.use(requestLogger);

// ── Serve frontend (static, before rate limiting) ──
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Rate limiting ─────────────────────────────────
app.use(generalLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/transactions',  paymentLimiter);
app.use('/api/payments',      paymentLimiter);

// ── Routes ────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/stations',     require('./routes/stations'));
app.use('/api/fuel-types',   require('./routes/fuel'));
app.use('/api/vehicles',     require('./routes/vehicles'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/loyalty',      require('./routes/loyalty'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/employee',     require('./routes/employee'));
app.use('/api/payments',     require('./routes/payments'));
app.use('/api/upload',       require('./routes/upload'));
app.use('/api/push',         require('./routes/push'));
app.use('/api/weather',      require('./routes/weather'));
app.use('/api/currency',     require('./routes/currency'));

// ── Health check ─────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'FuelGO API', ts: new Date() }));

// ── Global error handler ─────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Boot ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;
(async () => {
  try {
    await initDB();
    server.listen(PORT, () => console.log(`FuelGO API running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
})();
