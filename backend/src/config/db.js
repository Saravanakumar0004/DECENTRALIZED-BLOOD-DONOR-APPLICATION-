import mongoose from 'mongoose';
import logger from '../utils/logger.js';

let connectionPromise = null;

const connectDB = async () => {
  if (connectionPromise) return connectionPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in environment variables.');

  connectionPromise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
    })
    .then((conn) => {
      logger.info(`MongoDB connected: ${conn.connection.host}`);
      mongoose.connection.on('error', (err) => {
        logger.error(`MongoDB error: ${err.message}`);
        connectionPromise = null;
      });
      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        connectionPromise = null;
      });
      return conn;
    })
    .catch((err) => {
      connectionPromise = null;
      throw new Error(`MongoDB connection failed: ${err.message}`);
    });

  return connectionPromise;
};

export default connectDB;