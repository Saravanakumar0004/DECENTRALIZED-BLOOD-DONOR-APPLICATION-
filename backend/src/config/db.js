import mongoose from 'mongoose';
import logger from '../utils/logger.js';

// Cache the connection promise so warm Lambda/Vercel invocations reuse it.
let connectionPromise = null;

const connectDB = async () => {
  // Return cached connection on warm invocations
  if (connectionPromise) return connectionPromise;

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is undefined. Set it in your Vercel environment variables.');
  }

  connectionPromise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
    })
    .then((conn) => {
      logger.info(`MongoDB connected: ${conn.connection.host}`);

      mongoose.connection.on('error', (err) => {
        logger.error(`MongoDB error: ${err.message}`);
        // Reset cache so next request re-connects
        connectionPromise = null;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        connectionPromise = null;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

      return conn;
    })
    .catch((err) => {
      // Reset cache so next invocation retries
      connectionPromise = null;
      // Throw instead of process.exit() — let the serverless handler return 503
      throw new Error(`MongoDB connection failed: ${err.message}`);
    });

  return connectionPromise;
};

export default connectDB;
