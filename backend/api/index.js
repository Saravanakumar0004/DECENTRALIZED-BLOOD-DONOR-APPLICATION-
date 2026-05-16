import 'dotenv/config';
import app from '../src/app.js';
import connectDB from '../src/config/db.js';

let dbReady = false;

export default async function handler(req, res) {
  if (!dbReady) {
    try {
      await connectDB();
      dbReady = true;
    } catch (err) {
      console.error('[Vercel] DB connection failed:', err.message);
      return res.status(503).json({
        message: 'Database unavailable. Check MONGODB_URI in Vercel environment variables.',
        error: err.message,
      });
    }
  }
  return app(req, res);
}