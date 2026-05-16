/**
 * Local development server only.
 * On Vercel, api/index.js is the entry point — this file is never executed.
 */
import 'dotenv/config';
import app from './app.js';
import connectDB from './config/db.js';
import { testCloudinaryConnection } from './config/cloudinary.js';
import { testEmailConnection } from './config/email.js';
import registerCronJobs from './config/cron.js';
import logger from './utils/logger.js';

const PORT = parseInt(process.env.PORT, 10) || 5000;

const startServer = async () => {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Test optional services (warn but don't exit)
  await Promise.all([
    testCloudinaryConnection(),
    testEmailConnection(),
  ]);

  // 3. Register cron jobs
  registerCronJobs();

  // 4. Start HTTP server
  const server = app.listen(PORT, () => {
    logger.info(`🩸 BloodLink backend running on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Rejection: ${reason}`);
  });
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
    process.exit(1);
  });
};

startServer();
