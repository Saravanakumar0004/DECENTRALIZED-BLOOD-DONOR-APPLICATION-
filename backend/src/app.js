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

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 50,
  standardHeaders: true,
  legacyHeaders:   false,
  skip: () => process.env.NODE_ENV === 'development',
  message: { message: 'Too many auth attempts, please try again later.' },
});

app.use('/api', globalLimiter);
app.use('/api/auth/login',    authLimiter);
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