import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   parseInt(process.env.EMAIL_PORT, 10),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const testEmailConnection = async () => {
  try {
    await transporter.verify();
    logger.info('Email transporter connected');
  } catch (err) {
    logger.warn(`Email transporter warning: ${err.message}`);
  }
};

export default transporter;
