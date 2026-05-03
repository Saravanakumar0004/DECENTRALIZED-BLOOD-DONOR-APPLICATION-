import Donation from '../models/Donation.js';
import BloodRequest from '../models/BloodRequest.js';
import User from '../models/User.js';
import BloodInventory from '../models/BloodInventory.js';
import { createError } from '../utils/errors.js';
import { verifyDonationHash, isValidTxHash, isValidBlockchainHash } from '../utils/hashDonation.js';
import { awardBDC } from '../utils/bdcService.js';
import {
  sendDonorConfirmedEmail,
  sendDonationCompletedEmail,
} from '../utils/sendEmail.js';

const BDC_REWARD = parseInt(process.env.BDC_REWARD_PER_DONATION, 10) || 100;

// ── Populate helper ───────────────────────────────────────────────────────────
const populateDonation = (query) =>
  query
    .populate('request',  'bloodGroup urgencyLevel unitsRequired location notes')
    .populate('donor',    'name email bloodGroup walletAddress location.city')
    .populate('hospital', 'name email hospitalName location.city walletAddress');

// ── GET /api/donations/my ─────────────────────────────────────────────────────
export const getMyDonations = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { donor: req.user._id };
    if (status) filter.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [donations, total] = await Promise.all([
      populateDonation(Donation.find(filter))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Donation.countDocuments(filter),
    ]);

    res.json({
      total,
      page:  parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      data:  donations,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/donations/:id ────────────────────────────────────────────────────
export const getDonationById = async (req, res, next) => {
  try {
    const donation = await populateDonation(Donation.findById(req.params.id));
    if (!donation) return next(createError(404, 'Donation not found'));

    // Access control: donor, hospital, or admin
    const userId = req.user._id.toString();
    const isDonor    = donation.donor?._id?.toString()    === userId;
    const isHospital = donation.hospital?._id?.toString() === userId;
    const isAdmin    = req.user.role === 'ADMIN';

    if (!isDonor && !isHospital && !isAdmin) {
      return next(createError(403, 'Access denied'));
    }

    res.json({ data: { ...donation.toJSON(), readyForBlockchain: donation.readyForBlockchain } });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/donations/:id/donor-confirm ─────────────────────────────────────
export const donorConfirm = async (req, res, next) => {
  try {
    const donation = await populateDonation(Donation.findById(req.params.id));
    if (!donation) return next(createError(404, 'Donation not found'));

    // Must be the donor
    if (donation.donor._id.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Only the assigned donor can confirm this donation'));
    }

    if (donation.donorConfirmed) {
      return next(createError(409, 'Donation already confirmed by donor'));
    }

    if (['COMPLETED', 'CANCELLED'].includes(donation.status)) {
      return next(createError(400, `Cannot confirm a ${donation.status} donation`));
    }

    donation.donorConfirmed   = true;
    donation.donorConfirmedAt = new Date();
    donation.status = donation.receiverConfirmed
      ? 'RECEIVER_CONFIRMED'
      : 'DONOR_CONFIRMED';

    await donation.save();

    // Notify hospital
    sendDonorConfirmedEmail({
      hospitalEmail: donation.hospital.email,
      hospitalName:  donation.hospital.hospitalName || donation.hospital.name,
      donorName:     donation.donor.name,
      donationId:    donation._id.toString(),
    });

    res.json({
      message:            'Donor confirmation recorded',
      status:             donation.status,
      readyForBlockchain: donation.readyForBlockchain,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/donations/:id/receiver-confirm ──────────────────────────────────
export const receiverConfirm = async (req, res, next) => {
  try {
    const { bloodBagId } = req.body;

    if (!bloodBagId || bloodBagId.trim() === '') {
      return next(createError(422, 'Blood bag ID is required to confirm receipt'));
    }

    const donation = await populateDonation(Donation.findById(req.params.id));
    if (!donation) return next(createError(404, 'Donation not found'));

    // Must be the hospital that owns this donation
    if (donation.hospital._id.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Only the assigned hospital can confirm receipt'));
    }

    if (donation.receiverConfirmed) {
      return next(createError(409, 'Receipt already confirmed by hospital'));
    }

    if (['COMPLETED', 'CANCELLED'].includes(donation.status)) {
      return next(createError(400, `Cannot confirm a ${donation.status} donation`));
    }

    donation.bloodBagId          = bloodBagId.trim();
    donation.receiverConfirmed   = true;
    donation.receiverConfirmedAt = new Date();
    donation.status = donation.donorConfirmed
      ? 'RECEIVER_CONFIRMED'
      : donation.status; // stay PENDING if donor hasn't confirmed yet

    if (donation.donorConfirmed) {
      donation.status = 'RECEIVER_CONFIRMED';
    }

    await donation.save();

    res.json({
      message:            'Receipt confirmed',
      status:             donation.status,
      readyForBlockchain: donation.readyForBlockchain,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/donations/:id/upload-proof ──────────────────────────────────────
export const uploadProof = async (req, res, next) => {
  try {
    if (!req.file) return next(createError(400, 'No file uploaded'));

    const donation = await Donation.findById(req.params.id);
    if (!donation) return next(createError(404, 'Donation not found'));

    if (donation.donor.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Only the donor can upload proof'));
    }

    donation.proofImageUrl = req.file.path; // Cloudinary secure URL
    await donation.save();

    res.json({ message: 'Proof image uploaded', imageUrl: donation.proofImageUrl });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/donations/:id/upload-receipt ────────────────────────────────────
export const uploadReceipt = async (req, res, next) => {
  try {
    if (!req.file) return next(createError(400, 'No file uploaded'));

    const donation = await Donation.findById(req.params.id);
    if (!donation) return next(createError(404, 'Donation not found'));

    if (donation.hospital.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Only the hospital can upload a receipt'));
    }

    donation.hospitalReceiptUrl = req.file.path;
    await donation.save();

    res.json({ message: 'Receipt uploaded', imageUrl: donation.hospitalReceiptUrl });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/donations/:id/blockchain ────────────────────────────────────────
export const recordBlockchain = async (req, res, next) => {
  try {
    const { txHash, blockchainHash } = req.body;

    // Format validation
    if (!isValidTxHash(txHash)) {
      return next(createError(422, 'Invalid Ethereum transaction hash format'));
    }
    if (!isValidBlockchainHash(blockchainHash)) {
      return next(createError(422, 'Invalid blockchain hash format'));
    }

    const donation = await populateDonation(Donation.findById(req.params.id));
    if (!donation) return next(createError(404, 'Donation not found'));

    // Only the donor triggers blockchain recording
    if (donation.donor._id.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Only the donor can record on blockchain'));
    }

    // Must be ready
    if (!donation.readyForBlockchain) {
      return next(createError(400, 'Donation is not ready for blockchain recording. Both confirmations and blood bag ID required.'));
    }

    if (donation.status === 'COMPLETED') {
      return next(createError(409, 'Donation already recorded on blockchain'));
    }

    // Ensure tx hash is not already used (prevent replay)
    const duplicate = await Donation.findOne({ txHash });
    if (duplicate) {
      return next(createError(409, 'This transaction hash has already been used'));
    }

    // ── Server-side hash verification ────────────────────────────────────────
    const donor = donation.donor;
    if (!donor.walletAddress) {
      return next(createError(400, 'Donor must connect a wallet address before recording on blockchain'));
    }

    const hashValid = verifyDonationHash(
      donation.bloodBagId,
      donor.walletAddress,
      donation.donorConfirmedAt,
      blockchainHash
    );

    if (!hashValid) {
      return next(createError(400, 'Blockchain hash verification failed. Hash does not match donation data.'));
    }

    // ── Complete the donation ─────────────────────────────────────────────────
    donation.blockchainHash = blockchainHash;
    donation.txHash         = txHash;
    donation.status         = 'COMPLETED';
    donation.completedAt    = new Date();
    donation.bdcAwarded     = BDC_REWARD;
    await donation.save();

    // Update request to COMPLETED
    await BloodRequest.findByIdAndUpdate(donation.request._id, { status: 'COMPLETED' });

    // Update donor's lastDonationDate
    await User.findByIdAndUpdate(donor._id, { lastDonationDate: new Date() });

    // ── AUTO-ADD donated blood to hospital inventory ───────────────────────────
    const bloodGroupReceived = donation.request?.bloodGroup;
    if (bloodGroupReceived) {
      let inv = await BloodInventory.findOne({ hospital: donation.hospital._id });
      if (!inv) {
        inv = await BloodInventory.create({ hospital: donation.hospital._id });
      }
      const current = inv.stock.get(bloodGroupReceived) || { units: 0 };
      inv.stock.set(bloodGroupReceived, {
        units:       current.units + 1, // 1 donation = 1 unit
        lastUpdated: new Date(),
      });
      inv.lastStockUpdate = new Date();
      inv.markModified('stock');
      await inv.save();
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Award BDC tokens
    await awardBDC({
      userId:     donor._id,
      amount:     BDC_REWARD,
      reason:     'DONATION_REWARD',
      donationId: donation._id,
      txHash,
    });

    // Notify donor via email
    sendDonationCompletedEmail({
      donorEmail:  donor.email,
      donorName:   donor.name,
      bdcAwarded:  BDC_REWARD,
      txHash,
      bloodGroup:  donation.request?.bloodGroup || '',
    });

    res.json({
      message:        'Donation recorded on blockchain successfully',
      bdcAwarded:     BDC_REWARD,
      txHash,
      blockchainHash,
      completedAt:    donation.completedAt,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/donations/:id/dispute ──────────────────────────────────────────
export const disputeDonation = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return next(createError(422, 'Dispute reason is required'));

    const donation = await Donation.findById(req.params.id);
    if (!donation) return next(createError(404, 'Donation not found'));

    const userId = req.user._id.toString();
    const canDispute =
      donation.donor.toString()    === userId ||
      donation.hospital.toString() === userId ||
      req.user.role === 'ADMIN';

    if (!canDispute) return next(createError(403, 'Access denied'));

    if (donation.status === 'COMPLETED') {
      return next(createError(400, 'Cannot dispute a completed donation'));
    }

    donation.status        = 'DISPUTED';
    donation.disputeReason = reason;
    await donation.save();

    res.json({ message: 'Dispute raised. Admin will review shortly.', data: donation });
  } catch (err) {
    next(err);
  }
};