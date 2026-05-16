import BloodRequest from '../models/BloodRequest.js';
import logger from '../utils/logger.js';
import { sendRequestExpiredEmail } from '../utils/sendEmail.js';

export const expireOldRequests = async () => {
  try {
    const expiredRequests = await BloodRequest.find({
      status:    'OPEN',
      expiresAt: { $lte: new Date() },
    }).populate('hospital', 'name email hospitalName');

    if (expiredRequests.length === 0) return;

    const ids = expiredRequests.map((r) => r._id);
    await BloodRequest.updateMany({ _id: { $in: ids } }, { status: 'EXPIRED' });
    logger.info(`Cron: expired ${expiredRequests.length} blood requests`);

    for (const req of expiredRequests) {
      sendRequestExpiredEmail({
        hospitalEmail: req.hospital?.email,
        hospitalName:  req.hospital?.hospitalName || req.hospital?.name,
        bloodGroup:    req.bloodGroup,
        requestId:     req._id.toString(),
      });
    }
  } catch (err) {
    logger.error(`expireOldRequests error: ${err.message}`);
  }
};

const registerCronJobs = () => {
  // node-cron needs a persistent process — skip on Vercel serverless
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    logger.info('Cron jobs skipped (serverless environment)');
    return;
  }

  import('node-cron').then(({ default: cron }) => {
    cron.schedule('0 * * * *', expireOldRequests, { scheduled: true, timezone: 'UTC' });
    logger.info('Cron jobs registered: expireOldRequests (hourly)');
  }).catch((err) => {
    logger.warn(`Cron setup failed: ${err.message}`);
  });
};

export default registerCronJobs;