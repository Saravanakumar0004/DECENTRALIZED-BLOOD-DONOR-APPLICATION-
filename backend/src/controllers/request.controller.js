import BloodRequest from '../models/BloodRequest.js';
import Donation from '../models/Donation.js';
import User from '../models/User.js';
import { createError } from '../utils/errors.js';
import { sendDonorAcceptedEmail } from '../utils/sendEmail.js';

const DEFAULT_RADIUS_KM = parseInt(process.env.GEO_DEFAULT_RADIUS_KM, 10) || 50;

// ── Populate helper ───────────────────────────────────────────────────────────
const populateRequest = (query) =>
  query.populate('hospital', 'name email hospitalName location.city walletAddress');

// ── GET /api/requests ─────────────────────────────────────────────────────────
// Supports: ?bloodGroup=O+&urgency=Critical&lat=13.08&lng=80.27&radius=30&status=OPEN
export const getAllRequests = async (req, res, next) => {
  try {
    const {
      bloodGroup, urgency, status,
      lat, lng, radius,
      page = 1, limit = 20,
    } = req.query;

    const filter = {};

    // Status filter (default to OPEN)
    filter.status = status || 'OPEN';

    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (urgency)    filter.urgencyLevel = urgency;

    let query;

    if (lat && lng) {
      // Geo-based: find requests within radius
      const radiusMeters = (parseFloat(radius) || DEFAULT_RADIUS_KM) * 1000;

      query = BloodRequest.find({
        ...filter,
        location: {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)],
            },
            $maxDistance: radiusMeters,
          },
        },
      });
    } else {
      // No geo — sort by urgency priority then date
      query = BloodRequest.find(filter).sort({
        urgencyLevel: 1, // Critical < High < Medium (alphabetical sort on enum)
        createdAt:   -1,
      });
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    query = populateRequest(query).skip(skip).limit(parseInt(limit, 10));

    const [requests, total] = await Promise.all([
      query,
      BloodRequest.countDocuments(filter),
    ]);

    // Urgency sort order for non-geo results
    const urgencyOrder = { Critical: 0, High: 1, Medium: 2 };
    const sorted = lat && lng
      ? requests // already sorted by distance
      : requests.sort((a, b) =>
          (urgencyOrder[a.urgencyLevel] ?? 3) - (urgencyOrder[b.urgencyLevel] ?? 3)
        );

    res.json({
      total,
      page:  parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      data:  sorted,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/requests/:id ─────────────────────────────────────────────────────
export const getRequestById = async (req, res, next) => {
  try {
    const request = await populateRequest(BloodRequest.findById(req.params.id));
    if (!request) return next(createError(404, 'Blood request not found'));

    const donationCount = await Donation.countDocuments({ request: request._id });

    res.json({ data: request, donationCount });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/requests ────────────────────────────────────────────────────────
export const createRequest = async (req, res, next) => {
  try {
    const { bloodGroup, unitsRequired, urgencyLevel, city, lat, lng, notes } = req.body;

    if (!lat || !lng) return next(createError(422, 'lat and lng are required'));

    const request = await BloodRequest.create({
      hospital:      req.user._id,
      bloodGroup,
      unitsRequired: parseInt(unitsRequired, 10),
      urgencyLevel,
      location: {
        type:        'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)],
        city,
      },
      notes: notes || undefined,
    });

    await populateRequest(BloodRequest.findById(request._id)).then((r) => {
      res.status(201).json({ message: 'Blood request posted', data: r });
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/requests/:id/cancel ──────────────────────────────────────────────
export const cancelRequest = async (req, res, next) => {
  try {
    const request = await BloodRequest.findById(req.params.id);
    if (!request) return next(createError(404, 'Blood request not found'));

    // Hospital must own the request (or admin)
    if (
      req.user.role !== 'ADMIN' &&
      request.hospital.toString() !== req.user._id.toString()
    ) {
      return next(createError(403, 'You can only cancel your own requests'));
    }

    if (['COMPLETED', 'CANCELLED'].includes(request.status)) {
      return next(createError(400, `Cannot cancel a ${request.status} request`));
    }

    request.status = 'CANCELLED';
    await request.save();

    res.json({ message: 'Request cancelled', data: request });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/requests/:id/accept ─────────────────────────────────────────────
export const acceptRequest = async (req, res, next) => {
  try {
    const request = await BloodRequest.findById(req.params.id).populate('hospital', 'name email hospitalName');
    if (!request) return next(createError(404, 'Blood request not found'));

    if (request.status !== 'OPEN') {
      return next(createError(400, `This request is no longer open (status: ${request.status})`));
    }

    // Donor eligibility checks
    const donor = await User.findById(req.user._id);

    if (donor.age && donor.age < 18) {
      return next(createError(403, 'Donors must be at least 18 years old'));
    }
    if (donor.weight && donor.weight < 50) {
      return next(createError(403, 'Donors must weigh at least 50 kg'));
    }

    // 56-day cooldown check
    if (donor.lastDonationDate) {
      const cooldownDays = parseInt(process.env.DONATION_COOLDOWN_DAYS, 10) || 56;
      const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
      const daysSinceLast = Date.now() - new Date(donor.lastDonationDate).getTime();
      if (daysSinceLast < cooldownMs) {
        const remainingDays = Math.ceil((cooldownMs - daysSinceLast) / (24 * 60 * 60 * 1000));
        return next(createError(403, `You must wait ${remainingDays} more days before donating again`));
      }
    }

    // Prevent double-accepting the same request
    const existing = await Donation.findOne({ request: request._id, donor: req.user._id });
    if (existing) {
      return next(createError(409, 'You have already accepted this request'));
    }

    // Create donation document
    const donation = await Donation.create({
      request:  request._id,
      donor:    req.user._id,
      hospital: request.hospital._id,
    });

    // Mark request as ACCEPTED (single-donor model)
    request.status = 'ACCEPTED';
    request.acceptedDonorCount += 1;
    await request.save();

    // Notify hospital via email
    sendDonorAcceptedEmail({
      hospitalEmail: request.hospital.email,
      hospitalName:  request.hospital.hospitalName || request.hospital.name,
      donorName:     donor.name,
      bloodGroup:    request.bloodGroup,
      donationId:    donation._id.toString(),
    });

    res.status(201).json({
      message:    'Request accepted. Please proceed to donate.',
      donationId: donation._id,
      data:       donation,
    });
  } catch (err) {
    next(err);
  }
};
