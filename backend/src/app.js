import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import inventoryRouter from './routes/inventory.routes.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import requestRoutes from './routes/request.routes.js';
import donationRoutes from './routes/donation.routes.js';
import {
  hospitalRouter,
  bdcRouter,
  adminRouter,
  healthRouter,
} from './routes/index.routes.js';

import aiRoutes from './routes/ai.routes.js';
// Error handler
import errorHandler from './middleware/errorHandler.js';
import logger from './utils/logger.js';

const app = express();

// ── Trust proxy (REQUIRED for Vercel / any reverse-proxy deployment) ──────────
// Without this, express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
// and returns 500 on every request.
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
// Support multiple allowed origins: the production URL, localhost dev server,
// and any Vercel preview-deployment URL.
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (
        ALLOWED_ORIGINS.includes(origin) ||
        // Allow any Vercel preview URL for the same project
        /\.vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin "${origin}" not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── HTTP logger ───────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
    })
  );
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// trust proxy is set above, so express-rate-limit will correctly read the
// real client IP from X-Forwarded-For without throwing a validation error.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development',
  message: { message: 'Too many auth attempts, please try again later.' },
});

app.use('/api', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/health',    healthRouter);
app.use('/api/auth',      authRoutes);
app.use('/api/requests',  requestRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/hospital',  hospitalRouter);
app.use('/api/bdc',       bdcRouter);
app.use('/api/admin',     adminRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/ai',        aiRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

export default app;
