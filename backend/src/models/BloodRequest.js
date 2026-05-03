import mongoose from 'mongoose';

const BLOOD_GROUPS   = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const URGENCY_LEVELS = ['Critical', 'High', 'Medium'];
const STATUSES       = ['OPEN', 'ACCEPTED', 'COMPLETED', 'CANCELLED', 'EXPIRED'];

const bloodRequestSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Hospital reference is required'],
    },
    bloodGroup: {
      type: String,
      enum: { values: BLOOD_GROUPS, message: 'Invalid blood group' },
      required: [true, 'Blood group is required'],
    },
    unitsRequired: {
      type: Number,
      required: [true, 'Units required is required'],
      min: [1, 'Minimum 1 unit required'],
      max: [20, 'Maximum 20 units per request'],
    },
    urgencyLevel: {
      type: String,
      enum: { values: URGENCY_LEVELS, message: 'Urgency must be Critical, High, or Medium' },
      required: [true, 'Urgency level is required'],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Coordinates are required'],
        validate: {
          validator: (v) => v.length === 2,
          message: 'Coordinates must be [longitude, latitude]',
        },
      },
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
      },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: { values: STATUSES },
      default: 'OPEN',
    },
    // Tracks how many donors have accepted (for multi-donor support)
    acceptedDonorCount: { type: Number, default: 0 },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform(_, ret) { delete ret.__v; return ret; } },
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
bloodRequestSchema.index({ location: '2dsphere' });
bloodRequestSchema.index({ bloodGroup: 1, status: 1 });
bloodRequestSchema.index({ hospital: 1, status: 1 });
bloodRequestSchema.index({ urgencyLevel: 1, status: 1 });
bloodRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// ── Virtuals ─────────────────────────────────────────────────────────────────
bloodRequestSchema.virtual('isExpired').get(function () {
  return this.expiresAt && new Date() > this.expiresAt;
});

// ── Hooks ────────────────────────────────────────────────────────────────────
bloodRequestSchema.pre('save', function (next) {
  if (this.isNew && !this.expiresAt) {
    const hours = parseInt(process.env.REQUEST_EXPIRY_HOURS, 10) || 72;
    this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  }
  next();
});

const BloodRequest = mongoose.model('BloodRequest', bloodRequestSchema);
export default BloodRequest;
