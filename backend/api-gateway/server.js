require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { randomUUID } = require('crypto');

const app = express();

// ─── Service URLs from env ────────────────────────────────────────────────────
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || 'http://localhost:3002';
const REGISTRATION_SERVICE_URL = process.env.REGISTRATION_SERVICE_URL || 'http://localhost:3003';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
// ⚠️  Do NOT add express.json() or express.urlencoded() here.
// The gateway is a pure reverse-proxy — body parsing must NOT happen at this layer.
// http-proxy-middleware pipes the raw HTTP stream to downstream services;
// if the body is consumed here the stream will be empty and requests will hang indefinitely.
// ─── Correlation ID middleware ───────────────────────────────────────────────
// Injects x-request-id into every request so logs across services can be correlated.
app.use((req, _res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || randomUUID();
  next();
});

if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ─── Health Check (live downstream ping) ──────────────────────────────────────
// Pings each downstream /health endpoint in parallel and reports real status.
const pingService = (url, name) =>
  new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(`${url}/health`, { timeout: 3000 }, (res) => {
      resolve({ name, status: res.statusCode === 200 ? 'ok' : 'degraded', latency: `${Date.now() - start}ms` });
      res.resume();
    });
    req.on('error', () => resolve({ name, status: 'unreachable', latency: null }));
    req.on('timeout', () => { req.destroy(); resolve({ name, status: 'timeout', latency: null }); });
  });

app.get('/health', async (req, res) => {
  const [auth, events, registrations] = await Promise.all([
    pingService(AUTH_SERVICE_URL, 'user-auth-service'),
    pingService(EVENT_SERVICE_URL, 'event-service'),
    pingService(REGISTRATION_SERVICE_URL, 'registration-service'),
  ]);

  const allOk = [auth, events, registrations].every((s) => s.status === 'ok');
  res.status(allOk ? 200 : 207).json({
    success: allOk,
    service: 'API Gateway',
    timestamp: new Date().toISOString(),
    services: { auth, events, registrations },
  });
});

// ─── Proxy Config Helper ───────────────────────────────────────────────────────
const createProxy = (target) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
    pathRewrite: {},
    // Prevents the gateway from hanging if a downstream service is slow.
    // proxyTimeout = max time waiting for upstream to respond (ms).
    proxyTimeout: 10000,
    timeout: 10000,
    onProxyReq: (proxyReq, req) => {
      // Forward correlation ID to downstream so it appears in their logs
      if (req.headers['x-request-id']) {
        proxyReq.setHeader('x-request-id', req.headers['x-request-id']);
      }
    },
    onError: (err, req, res) => {
      console.error(`❌ Proxy Error to ${target} [${req.headers['x-request-id']}]:`, err.message);
      res.status(503).json({
        success: false,
        message: 'Service unavailable. Please try again shortly.',
        service: target,
        requestId: req.headers['x-request-id'],
      });
    },
  });
};

// ─── Routes: Auth Service ──────────────────────────────────────────────────────
// /api/auth/* and /api/users/* → Auth Service
app.use('/api/auth', createProxy(AUTH_SERVICE_URL));
app.use('/api/users', createProxy(AUTH_SERVICE_URL));

// ─── Routes: Event Service ────────────────────────────────────────────────────
// /api/events/* and /api/categories/* → Event Service
app.use('/api/events', createProxy(EVENT_SERVICE_URL));
app.use('/api/categories', createProxy(EVENT_SERVICE_URL));

// ─── Routes: Registration Service ──────────────────────────────────────────────
// /api/registrations/* and /api/notifications/* → Registration Service
app.use('/api/registrations', createProxy(REGISTRATION_SERVICE_URL));
app.use('/api/notifications', createProxy(REGISTRATION_SERVICE_URL));

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found on gateway`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Gateway Error:', err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║ 🚀 API Gateway running on http://localhost:${PORT}   ║
║                                                    ║
║ Routes:                                            ║
║  /api/auth        → ${AUTH_SERVICE_URL}     ║
║  /api/users       → ${AUTH_SERVICE_URL}     ║
║  /api/events      → ${EVENT_SERVICE_URL}    ║
║  /api/categories  → ${EVENT_SERVICE_URL}    ║
║  /api/registrations → ${REGISTRATION_SERVICE_URL}   ║
║  /api/notifications → ${REGISTRATION_SERVICE_URL}   ║
╚════════════════════════════════════════════════════╝
  `);
});
