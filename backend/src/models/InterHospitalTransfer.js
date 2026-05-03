// models/InterHospitalTransfer.js  ── NEW FILE
import mongoose from 'mongoose';

const BLOOD_GROUPS  = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const URGENCY_LEVELS = ['Critical', 'High', 'Medium'];

/**
 * Lifecycle:
 *  PENDING   → requesting hospital raised transfer request
 *  ACCEPTED  → supplying hospital accepted (blood reserved from inventory)
 *  IN_TRANSIT → ambulance dispatched / on the way
 *  DELIVERED  → receiving hospital confirmed receipt (inventory deducted)
 *  CANCELLED  → either party or admin cancelled
 *  REJECTED   → supplying hospital rejected the request
 */
const STATUSES = ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'REJECTED'];

const interHospitalTransferSchema = new mongoose.Schema(
  {
    // Hospital that NEEDS the blood
    requestingHospital: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Requesting hospital is required'],
    },

    // Hospital that SUPPLIES the blood
    supplyingHospital: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Supplying hospital is required'],
    },

    bloodGroup: {
      type:     String,
      enum:     { values: BLOOD_GROUPS, message: 'Invalid blood group' },
      required: [true, 'Blood group is required'],
    },

    unitsRequested: {
      type:     Number,
      required: [true, 'Units requested is required'],
      min:      [1, 'Minimum 1 unit'],
      max:      [50, 'Maximum 50 units per transfer'],
    },

    urgencyLevel: {
      type:    String,
      enum:    { values: URGENCY_LEVELS },
      default: 'Medium',
    },

    status: {
      type:    String,
      enum:    { values: STATUSES },
      default: 'PENDING',
    },

    notes: {
      type:      String,
      trim:      true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },

    // Rejection / cancellation reason
    rejectionReason: { type: String, trim: true },

    // Ambulance / logistics info (filled when IN_TRANSIT)
    ambulanceInfo: {
      vehicleNumber: { type: String, trim: true },
      driverName:    { type: String, trim: true },
      driverPhone:   { type: String, trim: true },
      dispatchedAt:  { type: Date },
    },

    // Blockchain traceability (optional)
    txHash:         { type: String },
    blockchainHash: { type: String },

    // Timestamps for each stage
    acceptedAt:  Date,
    inTransitAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
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
interHospitalTransferSchema.index({ requestingHospital: 1, status: 1 });
interHospitalTransferSchema.index({ supplyingHospital:  1, status: 1 });
interHospitalTransferSchema.index({ bloodGroup: 1, status: 1 });
interHospitalTransferSchema.index({ createdAt: -1 });

const InterHospitalTransfer = mongoose.model('InterHospitalTransfer', interHospitalTransferSchema);
export default InterHospitalTransfer;