import User from '../models/User.js';
import BDCLedger from '../models/BDCLedger.js';
import { createError } from '../utils/errors.js';
import { deductBDC } from '../utils/bdcService.js';

// ── GET /api/bdc/balance ──────────────────────────────────────────────────────
export const getBalance = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('bdcBalance name');
    if (!user) return next(createError(404, 'User not found'));

    res.json({ bdcBalance: user.bdcBalance, name: user.name });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/bdc/history ──────────────────────────────────────────────────────
export const getLedgerHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [entries, total] = await Promise.all([
      BDCLedger.find({ user: req.user._id })
        .populate('donation', 'status bloodBagId txHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      BDCLedger.countDocuments({ user: req.user._id }),
    ]);

    res.json({
      total,
      page:  parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      data:  entries,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/bdc/redeem ──────────────────────────────────────────────────────
// Future: allow spending BDC at partner hospitals/gyms
export const redeemBDC = async (req, res, next) => {
  try {
    const { amount, note } = req.body;

    if (!amount || amount <= 0) {
      return next(createError(422, 'Amount must be a positive number'));
    }

    const result = await deductBDC({
      userId: req.user._id,
      amount: parseInt(amount, 10),
      reason: 'REDEMPTION',
      note:   note || 'BDC redemption',
    });

    res.json({
      message:     `${amount} BDC redeemed successfully`,
      newBalance:  result.newBalance,
      ledgerEntry: result.ledgerEntry,
    });
  } catch (err) {
    next(err);
  }
};
