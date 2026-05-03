import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const ROLES = ['DONOR', 'HOSPITAL', 'ADMIN'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never return password by default
    },
    role: {
      type: String,
      enum: { values: ROLES, message: 'Role must be DONOR, HOSPITAL, or ADMIN' },
      required: [true, 'Role is required'],
    },

    // ── DONOR fields ──────────────────────────────────────────
    bloodGroup: {
      type: String,
      enum: { values: BLOOD_GROUPS, message: 'Invalid blood group' },
    },
    age:    { type: Number, min: [18, 'Donors must be at least 18'], max: 65 },
    weight: { type: Number, min: [50, 'Minimum donor weight is 50 kg'] }, // kg
    lastDonationDate: Date,
    healthConditions: [{ type: String, trim: true }],

    // ── HOSPITAL fields ───────────────────────────────────────
    hospitalName:  { type: String, trim: true },
    licenseNumber: { type: String, trim: true },

    // ── Shared / Geo ──────────────────────────────────────────
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
        validate: {
          validator: (v) => v.length === 2,
          message: 'Coordinates must be [longitude, latitude]',
        },
      },
      city: { type: String, trim: true },
    },

    // ── Blockchain / Rewards ──────────────────────────────────
    walletAddress: {
      type: String,
      lowercase: true,
      match: [/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address'],
    },
    bdcBalance: { type: Number, default: 0, min: 0 },

    // ── Status ────────────────────────────────────────────────
    isVerified: { type: Boolean, default: false },
    isActive:   { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Indexes ─────────────────────────────────────────────────────────────────
userSchema.index({ location: '2dsphere' });
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ bloodGroup: 1, role: 1 });

// ── Virtuals ─────────────────────────────────────────────────────────────────
userSchema.virtual('isEligibleToDonate').get(function () {
  if (this.role !== 'DONOR') return false;
  if (!this.lastDonationDate) return true;
  const cooldownMs = (parseInt(process.env.DONATION_COOLDOWN_DAYS, 10) || 56) * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(this.lastDonationDate).getTime() >= cooldownMs;
});

// ── Hooks ────────────────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Methods ──────────────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toJSON();
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
