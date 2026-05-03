import cron from 'node-cron';
import BloodRequest from '../models/BloodRequest.js';
import logger from '../utils/logger.js';
import { sendRequestExpiredEmail } from '../utils/sendEmail.js';

/**
 * expireOldRequests — runs every hour.
 * Finds OPEN requests past their expiresAt date, marks them EXPIRED,
 * and emails the hospital.
 */
const expireOldRequests = async () => {
  try {
    const expiredRequests = await BloodRequest.find({
      status:    'OPEN',
      expiresAt: { $lte: new Date() },
    }).populate('hospital', 'name email hospitalName');

    if (expiredRequests.length === 0) return;

    const ids = expiredRequests.map((r) => r._id);
    await BloodRequest.updateMany({ _id: { $in: ids } }, { status: 'EXPIRED' });

    logger.info(`Cron: expired ${expiredRequests.length} blood requests`);

    // Send email to each hospital
    for (const req of expiredRequests) {
      sendRequestExpiredEmail({
        hospitalEmail: req.hospital?.email,
        hospitalName:  req.hospital?.hospitalName || req.hospital?.name,
        bloodGroup:    req.bloodGroup,
        requestId:     req._id.toString(),
      });
    }
  } catch (err) {
    logger.error(`Cron expireOldRequests error: ${err.message}`);
  }
};

/**
 * registerCronJobs — call once on server startup.
 */
const registerCronJobs = () => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', expireOldRequests, {
    scheduled: true,
    timezone:  'UTC',
  });

  logger.info('Cron jobs registered: expireOldRequests (hourly)');
};

export default registerCronJobs;
