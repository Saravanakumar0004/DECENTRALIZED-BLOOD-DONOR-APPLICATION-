import mongoose from 'mongoose';
import User from '../models/User.js';
import BDCLedger from '../models/BDCLedger.js';
import logger from './logger.js';
import { createError } from './errors.js';

/**
 * awardBDC — credits BDC to a user's balance and creates a ledger entry.
 * Runs inside a MongoDB session to ensure atomicity.
 *
 * @param {object} opts
 * @param {string}  opts.userId     — User ObjectId
 * @param {number}  opts.amount     — BDC amount to credit (positive)
 * @param {string}  opts.reason     — BDCLedger reason enum value
 * @param {string}  [opts.donationId] — Related donation ObjectId
 * @param {string}  [opts.txHash]   — On-chain tx hash
 * @param {string}  [opts.note]     — Optional admin note
 * @param {object}  [opts.session]  — Existing mongoose session (optional)
 * @returns {object} { newBalance, ledgerEntry }
 */
export const awardBDC = async ({ userId, amount, reason, donationId, txHash, note, session }) => {
  const ownSession = !session;
  if (ownSession) session = await mongoose.startSession();

  try {
    let result;
    const run = async (sess) => {
      // Atomically increment bdcBalance
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { bdcBalance: amount } },
        { new: true, session: sess }
      );
      if (!user) throw createError(404, 'User not found for BDC award');

      const ledgerEntry = await BDCLedger.create(
        [{
          user:         userId,
          donation:     donationId || undefined,
          amount,
          balanceAfter: user.bdcBalance,
          reason,
          txHash:       txHash || undefined,
          note:         note || undefined,
        }],
        { session: sess }
      );

      result = { newBalance: user.bdcBalance, ledgerEntry: ledgerEntry[0] };
    };

    if (ownSession) {
      await session.withTransaction(run);
    } else {
      await run(session);
    }

    return result;
  } catch (err) {
    logger.error(`awardBDC failed for user ${userId}: ${err.message}`);
    throw err;
  } finally {
    if (ownSession) session.endSession();
  }
};

/**
 * deductBDC — debits BDC from a user. Throws if insufficient balance.
 */
export const deductBDC = async ({ userId, amount, reason, note, session }) => {
  const ownSession = !session;
  if (ownSession) session = await mongoose.startSession();

  try {
    let result;
    const run = async (sess) => {
      const user = await User.findById(userId).session(sess);
      if (!user) throw createError(404, 'User not found');
      if (user.bdcBalance < amount) {
        throw createError(400, `Insufficient BDC balance. Have: ${user.bdcBalance}, Need: ${amount}`);
      }

      user.bdcBalance -= amount;
      await user.save({ session: sess });

      const ledgerEntry = await BDCLedger.create(
        [{
          user:         userId,
          amount:       -amount,
          balanceAfter: user.bdcBalance,
          reason,
          note:         note || undefined,
        }],
        { session: sess }
      );

      result = { newBalance: user.bdcBalance, ledgerEntry: ledgerEntry[0] };
    };

    if (ownSession) {
      await session.withTransaction(run);
    } else {
      await run(session);
    }

    return result;
  } finally {
    if (ownSession) session.endSession();
  }
};
