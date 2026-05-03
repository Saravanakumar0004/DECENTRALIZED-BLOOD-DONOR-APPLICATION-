import mongoose from 'mongoose';

const REASONS = [
  'DONATION_REWARD',  // +100 BDC on completed donation
  'NFT_MINT_FEE',     // future: cost to mint premium NFT
  'REDEMPTION',       // spending BDC at partner stores
  'ADMIN_ADJUSTMENT', // admin manual correction
  'BONUS',            // promotional bonus
];

const bdcLedgerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    donation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
    },
    // Positive = credit, Negative = debit
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
    },
    // Running balance after this transaction
    balanceAfter: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      enum: { values: REASONS, message: 'Invalid BDC reason' },
      required: [true, 'Reason is required'],
    },
    txHash: String, // on-chain tx if applicable
    note:   String, // admin note
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_, ret) { delete ret.__v; return ret; },
    },
  }
);

bdcLedgerSchema.index({ user: 1, createdAt: -1 });
bdcLedgerSchema.index({ donation: 1 }, { sparse: true });

const BDCLedger = mongoose.model('BDCLedger', bdcLedgerSchema);
export default BDCLedger;
