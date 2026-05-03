import mongoose from 'mongoose';

const STATUSES = [
  'PENDING',
  'DONOR_CONFIRMED',
  'RECEIVER_CONFIRMED',
  'COMPLETED',
  'DISPUTED',
  'CANCELLED',
];

const donationSchema = new mongoose.Schema(
  {
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BloodRequest',
      required: [true, 'Request reference is required'],
    },
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Donor reference is required'],
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Hospital reference is required'],
    },

    // Set by hospital after physical blood packet check
    bloodBagId: {
      type: String,
      trim: true,
    },

    // Dual-confirmation
    donorConfirmed:      { type: Boolean, default: false },
    donorConfirmedAt:    Date,
    receiverConfirmed:   { type: Boolean, default: false },
    receiverConfirmedAt: Date,

    // Cloudinary URLs
    proofImageUrl:      String,
    hospitalReceiptUrl: String,

    // Blockchain
    blockchainHash: {
      type: String,
      maxlength: [66, 'Invalid blockchain hash length'], // 0x + 64 hex chars
    },
    txHash: {
      type: String,
      maxlength: [66, 'Invalid tx hash length'],
    },

    // Rewards
    bdcAwarded: { type: Number, default: 0 },
    nftTokenId: String,

    status: {
      type: String,
      enum: { values: STATUSES },
      default: 'PENDING',
    },

    completedAt: Date,
    disputeReason: String,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_, ret) { delete ret.__v; return ret; },
    },
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
donationSchema.index({ donor: 1, status: 1 });
donationSchema.index({ hospital: 1, status: 1 });
donationSchema.index({ request: 1 });
donationSchema.index({ txHash: 1 }, { sparse: true });

// ── Virtuals ─────────────────────────────────────────────────────────────────
donationSchema.virtual('readyForBlockchain').get(function () {
  return (
    this.donorConfirmed === true &&
    this.receiverConfirmed === true &&
    this.bloodBagId != null &&
    this.bloodBagId.trim() !== ''
  );
});

const Donation = mongoose.model('Donation', donationSchema);
export default Donation;
