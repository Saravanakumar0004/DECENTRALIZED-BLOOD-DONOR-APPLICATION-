/**
 * Vercel Serverless Entry Point
 *
 * Vercel runs the backend as serverless functions, NOT as a persistent HTTP
 * server. We must export the Express `app` directly — never call app.listen().
 *
 * DB connection is lazily cached across warm invocations so we don't open a
 * new connection on every single request.
 */
import 'dotenv/config';
import app from '../src/app.js';
import connectDB from '../src/config/db.js';

let isConnected = false;

async function ensureDB() {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
}

export default async function handler(req, res) {
  try {
    await ensureDB();
  } catch (err) {
    console.error('DB connection failed:', err.message);
    return res.status(503).json({ message: 'Service temporarily unavailable. DB connection failed.' });
  }
  return app(req, res);
}
