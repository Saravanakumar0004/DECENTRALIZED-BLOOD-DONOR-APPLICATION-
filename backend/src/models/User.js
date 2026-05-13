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

    // ── DONOR – Personal Details ───────────────────────────────
    gender: {
      type: String,
      enum: { values: ['Male', 'Female', 'Other'], message: 'Invalid gender' },
    },
    dateOfBirth: { type: Date },
    mobileNumber: {
      type: String,
      trim: true,
      match: [/^\+?[0-9]{7,15}$/, 'Invalid mobile number'],
    },
    address:  { type: String, trim: true },
    state:    { type: String, trim: true },
    pincode:  { type: String, trim: true },

    // FIX: profilePhoto stored as Buffer subdocument (same as medicalReportCertificate),
    // NOT a String URL. Was { type: String } before — that caused Mongoose validation
    // errors when the controller stored { data, contentType, fileName, uploadedAt }.
    profilePhoto: {
      data:        { type: Buffer },
      contentType: { type: String },
      fileName:    { type: String },
      uploadedAt:  { type: Date },
    },

    // ── DONOR – Medical Details ────────────────────────────────
    hemoglobinLevel:    { type: Number, min: 0 },
    currentMedications: [{ type: String, trim: true }],
    allergies:          [{ type: String, trim: true }],
    surgeryHistory:     [{ type: String, trim: true }],
    smokingStatus: {
      type: String,
      enum: { values: ['Non-Smoker', 'Smoker', 'Ex-Smoker'], message: 'Invalid smoking status' },
    },
    alcoholStatus: {
      type: String,
      enum: { values: ['None', 'Occasional', 'Regular'], message: 'Invalid alcohol status' },
    },
    covidVaccinationStatus: { type: String, trim: true },

    // ── DONOR – Eligibility Verification ──────────────────────
    fitForDonation: { type: Boolean },
    doctorVerificationStatus: {
      type: String,
      enum: { values: ['Pending', 'Verified', 'Rejected'], message: 'Invalid verification status' },
      default: 'Pending',
    },
    governmentIdNumber:     { type: String, trim: true },
    emergencyContactNumber: {
      type: String,
      trim: true,
      match: [/^\+?[0-9]{7,15}$/, 'Invalid emergency contact number'],
    },
    medicalReportCertificate: {
      data:        { type: Buffer },
      contentType: { type: String },
      fileName:    { type: String },
      uploadedAt:  { type: Date },
    },

    // ── HOSPITAL fields ────────────────────────────────────────
    hospitalName:  { type: String, trim: true },
    licenseNumber: { type: String, trim: true },

    // ── HOSPITAL – Basic Details ───────────────────────────────
    hospitalType: {
      type: String,
      enum: { values: ['Government', 'Private', 'Clinic'], message: 'Invalid hospital type' },
    },
    registrationNumber: { type: String, trim: true },
    establishedYear:    { type: Number, min: 1800, max: new Date().getFullYear() },

    // ── HOSPITAL – Contact Details ─────────────────────────────
    contactPersonName: { type: String, trim: true },
    hospitalMobile:    {
      type: String,
      trim: true,
      match: [/^\+?[0-9]{7,15}$/, 'Invalid hospital mobile number'],
    },
    hospitalTelephone: { type: String, trim: true },
    hospitalWebsite:   { type: String, trim: true },

    // ── HOSPITAL – Address ─────────────────────────────────────
    hospitalAddress:  { type: String, trim: true },
    hospitalState:    { type: String, trim: true },
    hospitalPincode:  { type: String, trim: true },
    hospitalLandmark: { type: String, trim: true },

    // ── HOSPITAL – Blood Bank Details ──────────────────────────
    bloodBankAvailable:        { type: Boolean, default: false },
    bloodStorageCapacity:      { type: Number, min: 0 },
    availableBloodGroups:      [{ type: String, enum: BLOOD_GROUPS }],
    emergencyServiceAvailable: { type: Boolean, default: false },
    is24x7Service:             { type: Boolean, default: false },

    // ── HOSPITAL – Verification Documents ─────────────────────
    hospitalLicenseCertificate: {
      data:        { type: Buffer },
      contentType: { type: String },
      fileName:    { type: String },
      uploadedAt:  { type: Date },
    },
    governmentApprovalDocument: {
      data:        { type: Buffer },
      contentType: { type: String },
      fileName:    { type: String },
      uploadedAt:  { type: Date },
    },
    gstNumber: { type: String, trim: true },
    adminIdProof: {
      data:        { type: Buffer },
      contentType: { type: String },
      fileName:    { type: String },
      uploadedAt:  { type: Date },
    },

    // FIX: hospitalPhoto stored as Buffer subdocument (same as other docs),
    // NOT a String URL. Was { type: String } before — same mismatch bug as profilePhoto.
    hospitalPhoto: {
      data:        { type: Buffer },
      contentType: { type: String },
      fileName:    { type: String },
      uploadedAt:  { type: Date },
    },

    // ── Shared / Geo ───────────────────────────────────────────
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

    // ── Blockchain / Rewards ───────────────────────────────────
    walletAddress: {
      type: String,
      lowercase: true,
      match: [/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address'],
    },
    bdcBalance: { type: Number, default: 0, min: 0 },

    // ── Status ─────────────────────────────────────────────────
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
        // Strip raw binary buffers from all file subdocuments
        if (ret.medicalReportCertificate)   delete ret.medicalReportCertificate.data;
        if (ret.profilePhoto)               delete ret.profilePhoto.data;
        if (ret.hospitalLicenseCertificate) delete ret.hospitalLicenseCertificate.data;
        if (ret.governmentApprovalDocument) delete ret.governmentApprovalDocument.data;
        if (ret.adminIdProof)               delete ret.adminIdProof.data;
        if (ret.hospitalPhoto)              delete ret.hospitalPhoto.data;
        return ret;
      },
    },
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ location: '2dsphere' });
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ bloodGroup: 1, role: 1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────
userSchema.virtual('isEligibleToDonate').get(function () {
  if (this.role !== 'DONOR') return false;
  if (!this.lastDonationDate) return true;
  const cooldownMs = (parseInt(process.env.DONATION_COOLDOWN_DAYS, 10) || 56) * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(this.lastDonationDate).getTime() >= cooldownMs;
});

// ── Hooks ─────────────────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Methods ───────────────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toJSON();
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;