import User from '../models/User.js';
import BloodRequest from '../models/BloodRequest.js';
import Donation from '../models/Donation.js';
import BDCLedger from '../models/BDCLedger.js';
import { createError } from '../utils/errors.js';
import { awardBDC } from '../utils/bdcService.js';

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
export const getPlatformStats = async (req, res, next) => {
  try {
    const [
      totalDonors,
      totalHospitals,
      totalAdmins,
      totalRequests,
      openRequests,
      completedRequests,
      totalDonations,
      pendingDonations,
      completedDonations,
      disputedDonations,
    ] = await Promise.all([
      User.countDocuments({ role: 'DONOR', isActive: true }),
      User.countDocuments({ role: 'HOSPITAL', isActive: true }),
      User.countDocuments({ role: 'ADMIN' }),
      BloodRequest.countDocuments(),
      BloodRequest.countDocuments({ status: 'OPEN' }),
      BloodRequest.countDocuments({ status: 'COMPLETED' }),
      Donation.countDocuments(),
      Donation.countDocuments({ status: 'PENDING' }),
      Donation.countDocuments({ status: 'COMPLETED' }),
      Donation.countDocuments({ status: 'DISPUTED' }),
    ]);

    const bdcAgg = await BDCLedger.aggregate([
      { $match: { reason: 'DONATION_REWARD' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalBDCIssued = bdcAgg[0]?.total || 0;

    // Donations by blood group
    const bloodGroupBreakdown = await Donation.aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $lookup: {
          from:         'bloodrequests',
          localField:   'request',
          foreignField: '_id',
          as:           'requestData',
        },
      },
      { $unwind: '$requestData' },
      { $group: { _id: '$requestData.bloodGroup', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Monthly donation trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await Donation.aggregate([
      { $match: { status: 'COMPLETED', completedAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id:   { year: { $year: '$completedAt' }, month: { $month: '$completedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      users:     { donors: totalDonors, hospitals: totalHospitals, admins: totalAdmins },
      requests:  { total: totalRequests, open: openRequests, completed: completedRequests },
      donations: { total: totalDonations, pending: pendingDonations, completed: completedDonations, disputed: disputedDonations },
      totalBDCIssued,
      bloodGroupBreakdown,
      monthlyTrend,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/users ──────────────────────────────────────────────────────
export const getAllUsers = async (req, res, next) => {
  try {
    const { role, isVerified, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (role)       filter.role = role;
    if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
    if (search)     filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
      User.countDocuments(filter),
    ]);

    res.json({
      total,
      page:  parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      data:  users,
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/admin/users/:id/verify ───────────────────────────────────────────
export const verifyUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: true },
      { new: true }
    );
    if (!user) return next(createError(404, 'User not found'));
    res.json({ message: `${user.name} verified successfully`, user });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/admin/users/:id/deactivate ───────────────────────────────────────
export const deactivateUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return next(createError(400, 'You cannot deactivate your own account'));
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!user) return next(createError(404, 'User not found'));
    res.json({ message: `${user.name} deactivated`, user });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/donations ──────────────────────────────────────────────────
export const getAllDonations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [donations, total] = await Promise.all([
      Donation.find(filter)
        .populate('donor',    'name email bloodGroup walletAddress')
        .populate('hospital', 'name email hospitalName')
        .populate('request',  'bloodGroup urgencyLevel location.city')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Donation.countDocuments(filter),
    ]);

    res.json({
      total,
      page:  parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      data:  donations.map((d) => ({ ...d.toJSON(), readyForBlockchain: d.readyForBlockchain })),
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/admin/donations/:id/resolve-dispute ──────────────────────────────
export const resolveDispute = async (req, res, next) => {
  try {
    const { resolution } = req.body; // 'COMPLETE' | 'CANCEL'
    if (!['COMPLETE', 'CANCEL'].includes(resolution)) {
      return next(createError(422, 'Resolution must be COMPLETE or CANCEL'));
    }

    const donation = await Donation.findById(req.params.id)
      .populate('donor', 'name email walletAddress');
    if (!donation) return next(createError(404, 'Donation not found'));
    if (donation.status !== 'DISPUTED') {
      return next(createError(400, 'Only disputed donations can be resolved'));
    }

    if (resolution === 'COMPLETE') {
      donation.status      = 'COMPLETED';
      donation.completedAt = new Date();
      donation.bdcAwarded  = parseInt(process.env.BDC_REWARD_PER_DONATION, 10) || 100;
      await donation.save();

      await awardBDC({
        userId:     donation.donor._id,
        amount:     donation.bdcAwarded,
        reason:     'ADMIN_ADJUSTMENT',
        donationId: donation._id,
        note:       'Admin resolved dispute — donation completed',
      });
    } else {
      donation.status = 'CANCELLED';
      await donation.save();
    }

    res.json({ message: `Dispute resolved: donation ${resolution.toLowerCase()}d`, data: donation });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/admin/requests/:id/cancel ───────────────────────────────────────
export const cancelAnyRequest = async (req, res, next) => {
  try {
    const request = await BloodRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'CANCELLED' },
      { new: true }
    );
    if (!request) return next(createError(404, 'Blood request not found'));
    res.json({ message: 'Request cancelled by admin', data: request });
  } catch (err) {
    next(err);
  }
};
