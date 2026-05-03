import BloodRequest from '../models/BloodRequest.js';
import Donation from '../models/Donation.js';
import { createError } from '../utils/errors.js';

// ── GET /api/hospital/requests ────────────────────────────────────────────────
export const getMyRequests = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { hospital: req.user._id };
    if (status) filter.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [requests, total] = await Promise.all([
      BloodRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      BloodRequest.countDocuments(filter),
    ]);

    // Attach donation count to each request
    const requestsWithCounts = await Promise.all(
      requests.map(async (req_) => {
        const donationCount = await Donation.countDocuments({ request: req_._id });
        return { ...req_.toJSON(), donationCount };
      })
    );

    res.json({
      total,
      page:  parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      data:  requestsWithCounts,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/hospital/donations ───────────────────────────────────────────────
export const getMyDonations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { hospital: req.user._id };
    if (status) filter.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [donations, total] = await Promise.all([
      Donation.find(filter)
        .populate('donor',   'name email bloodGroup walletAddress location.city')
        .populate('request', 'bloodGroup urgencyLevel unitsRequired location.city notes')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Donation.countDocuments(filter),
    ]);

    res.json({
      total,
      page:  parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      data:  donations.map((d) => ({
        ...d.toJSON(),
        readyForBlockchain: d.readyForBlockchain,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/hospital/stats ───────────────────────────────────────────────────
export const getStats = async (req, res, next) => {
  try {
    const hospitalId = req.user._id;

    const [
      openRequests,
      acceptedRequests,
      completedRequests,
      cancelledRequests,
      pendingDonations,
      donorConfirmedDonations,
      receiverConfirmedDonations,
      completedDonations,
      disputedDonations,
    ] = await Promise.all([
      BloodRequest.countDocuments({ hospital: hospitalId, status: 'OPEN' }),
      BloodRequest.countDocuments({ hospital: hospitalId, status: 'ACCEPTED' }),
      BloodRequest.countDocuments({ hospital: hospitalId, status: 'COMPLETED' }),
      BloodRequest.countDocuments({ hospital: hospitalId, status: 'CANCELLED' }),
      Donation.countDocuments({ hospital: hospitalId, status: 'PENDING' }),
      Donation.countDocuments({ hospital: hospitalId, status: 'DONOR_CONFIRMED' }),
      Donation.countDocuments({ hospital: hospitalId, status: 'RECEIVER_CONFIRMED' }),
      Donation.countDocuments({ hospital: hospitalId, status: 'COMPLETED' }),
      Donation.countDocuments({ hospital: hospitalId, status: 'DISPUTED' }),
    ]);

    // Total BDC issued through this hospital's donations
    const bdcAgg = await Donation.aggregate([
      { $match: { hospital: hospitalId, status: 'COMPLETED' } },
      { $group: { _id: null, totalBDC: { $sum: '$bdcAwarded' } } },
    ]);
    const totalBDCIssued = bdcAgg[0]?.totalBDC || 0;

    res.json({
      requests: {
        open:       openRequests,
        accepted:   acceptedRequests,
        completed:  completedRequests,
        cancelled:  cancelledRequests,
        total:      openRequests + acceptedRequests + completedRequests + cancelledRequests,
      },
      donations: {
        pending:           pendingDonations,
        donorConfirmed:    donorConfirmedDonations,
        receiverConfirmed: receiverConfirmedDonations,
        completed:         completedDonations,
        disputed:          disputedDonations,
        total:             pendingDonations + donorConfirmedDonations + receiverConfirmedDonations + completedDonations,
      },
      totalBDCIssued,
    });
  } catch (err) {
    next(err);
  }
};
