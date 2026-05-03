import { v2 as cloudinary } from 'cloudinary';
import logger from '../utils/logger.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Test connection on startup
export const testCloudinaryConnection = async () => {
  try {
    await cloudinary.api.ping();
    logger.info('Cloudinary connected');
  } catch (err) {
    logger.warn(`Cloudinary connection warning: ${err.message}`);
  }
};

export default cloudinary;
