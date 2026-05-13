import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import { sendWelcomeEmail } from '../utils/sendEmail.js';
import { createError } from '../utils/errors.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

// FIX: helper to return only file metadata (never the raw buffer).
// Used for ALL file subdocuments: profilePhoto, hospitalPhoto, and all cert/doc fields.
const fileMeta = (doc) =>
  doc
    ? { fileName: doc.fileName, contentType: doc.contentType, uploadedAt: doc.uploadedAt }
    : undefined;

const safeUser = (user) => ({
  id:           user._id,
  name:         user.name,
  email:        user.email,
  role:         user.role,
  bloodGroup:   user.bloodGroup,
  bdcBalance:   user.bdcBalance,
  walletAddress:user.walletAddress,
  isVerified:   user.isVerified,
  location:     user.location,
  age:          user.age,
  weight:       user.weight,
  lastDonationDate:  user.lastDonationDate,
  healthConditions:  user.healthConditions,
  hospitalName:      user.hospitalName,
  licenseNumber:     user.licenseNumber,
  createdAt:         user.createdAt,

  // ── DONOR – Personal ──────────────────────────────────────
  gender:          user.gender,
  dateOfBirth:     user.dateOfBirth,
  mobileNumber:    user.mobileNumber,
  address:         user.address,
  state:           user.state,
  pincode:         user.pincode,
  // FIX: profilePhoto is now a Buffer subdoc — return metadata only
  profilePhoto:    fileMeta(user.profilePhoto),

  // ── DONOR – Medical ───────────────────────────────────────
  hemoglobinLevel:        user.hemoglobinLevel,
  currentMedications:     user.currentMedications,
  allergies:              user.allergies,
  surgeryHistory:         user.surgeryHistory,
  smokingStatus:          user.smokingStatus,
  alcoholStatus:          user.alcoholStatus,
  covidVaccinationStatus: user.covidVaccinationStatus,

  // ── DONOR – Eligibility ───────────────────────────────────
  fitForDonation:           user.fitForDonation,
  doctorVerificationStatus: user.doctorVerificationStatus,
  governmentIdNumber:       user.governmentIdNumber,
  emergencyContactNumber:   user.emergencyContactNumber,
  medicalReportCertificate: fileMeta(user.medicalReportCertificate),

  // ── HOSPITAL – Basic ──────────────────────────────────────
  hospitalType:       user.hospitalType,
  registrationNumber: user.registrationNumber,
  establishedYear:    user.establishedYear,

  // ── HOSPITAL – Contact ────────────────────────────────────
  contactPersonName: user.contactPersonName,
  hospitalMobile:    user.hospitalMobile,
  hospitalTelephone: user.hospitalTelephone,
  hospitalWebsite:   user.hospitalWebsite,

  // ── HOSPITAL – Address ────────────────────────────────────
  hospitalAddress:  user.hospitalAddress,
  hospitalState:    user.hospitalState,
  hospitalPincode:  user.hospitalPincode,
  hospitalLandmark: user.hospitalLandmark,

  // ── HOSPITAL – Blood Bank ─────────────────────────────────
  bloodBankAvailable:        user.bloodBankAvailable,
  bloodStorageCapacity:      user.bloodStorageCapacity,
  availableBloodGroups:      user.availableBloodGroups,
  emergencyServiceAvailable: user.emergencyServiceAvailable,
  is24x7Service:             user.is24x7Service,

  // ── HOSPITAL – Documents (metadata only) ──────────────────
  hospitalLicenseCertificate: fileMeta(user.hospitalLicenseCertificate),
  governmentApprovalDocument: fileMeta(user.governmentApprovalDocument),
  gstNumber:    user.gstNumber,
  adminIdProof: fileMeta(user.adminIdProof),
  // FIX: hospitalPhoto is now a Buffer subdoc — return metadata only
  hospitalPhoto: fileMeta(user.hospitalPhoto),
});

// ── Helper: parse an uploaded file from multer into a document sub-object ─────
// Works with memoryStorage() — uses file.buffer, NOT file.path
const parseFile = (file) => {
  if (!file) return undefined;
  return {
    data:        file.buffer,
    contentType: file.mimetype,
    fileName:    file.originalname,
    uploadedAt:  new Date(),
  };
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const {
      name, email, password, role,
      bloodGroup, city, lat, lng,
      walletAddress, hospitalName, licenseNumber,
      age, weight,

      // DONOR – Personal
      gender, dateOfBirth, mobileNumber, address, state, pincode,

      // DONOR – Medical
      hemoglobinLevel, currentMedications, allergies, surgeryHistory,
      smokingStatus, alcoholStatus, covidVaccinationStatus,

      // DONOR – Eligibility
      fitForDonation, governmentIdNumber, emergencyContactNumber,

      // HOSPITAL – Basic
      hospitalType, registrationNumber, establishedYear,

      // HOSPITAL – Contact
      contactPersonName, hospitalMobile, hospitalTelephone, hospitalWebsite,

      // HOSPITAL – Address
      hospitalAddress, hospitalState, hospitalPincode, hospitalLandmark,

      // HOSPITAL – Blood Bank
      bloodBankAvailable, bloodStorageCapacity, availableBloodGroups,
      emergencyServiceAvailable, is24x7Service,

      // HOSPITAL – Other
      gstNumber,
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(createError(409, 'An account with this email already exists'));
    }

    // Role-specific validation
    if (role === 'DONOR' && !bloodGroup) {
      return next(createError(422, 'Blood group is required for donors'));
    }
    if (role === 'HOSPITAL' && !hospitalName) {
      return next(createError(422, 'Hospital name is required for hospital accounts'));
    }

    // Build create payload
    const payload = {
      name,
      email,
      password,
      role,
      walletAddress: walletAddress || undefined,
      location: {
        type:        'Point',
        coordinates: [parseFloat(lng) || 0, parseFloat(lat) || 0],
        city:        city || '',
      },
    };

    if (role === 'DONOR') {
      Object.assign(payload, {
        bloodGroup,
        age:             age || undefined,
        weight:          weight || undefined,
        gender:          gender || undefined,
        dateOfBirth:     dateOfBirth ? new Date(dateOfBirth) : undefined,
        mobileNumber:    mobileNumber || undefined,
        address:         address || undefined,
        state:           state || undefined,
        pincode:         pincode || undefined,
        hemoglobinLevel: hemoglobinLevel || undefined,
        currentMedications: Array.isArray(currentMedications) ? currentMedications : undefined,
        allergies:       Array.isArray(allergies) ? allergies : undefined,
        surgeryHistory:  Array.isArray(surgeryHistory) ? surgeryHistory : undefined,
        smokingStatus:   smokingStatus || undefined,
        alcoholStatus:   alcoholStatus || undefined,
        covidVaccinationStatus: covidVaccinationStatus || undefined,
        fitForDonation:  fitForDonation !== undefined ? fitForDonation : undefined,
        governmentIdNumber:     governmentIdNumber || undefined,
        emergencyContactNumber: emergencyContactNumber || undefined,
        medicalReportCertificate: req.files?.medicalReportCertificate
          ? parseFile(req.files.medicalReportCertificate[0])
          : undefined,
        profilePhoto: req.files?.profilePhoto
          ? parseFile(req.files.profilePhoto[0])
          : undefined,
      });
    }

    if (role === 'HOSPITAL') {
      Object.assign(payload, {
        hospitalName,
        licenseNumber:      licenseNumber || undefined,
        hospitalType:       hospitalType || undefined,
        registrationNumber: registrationNumber || undefined,
        establishedYear:    establishedYear || undefined,
        contactPersonName:  contactPersonName || undefined,
        hospitalMobile:     hospitalMobile || undefined,
        hospitalTelephone:  hospitalTelephone || undefined,
        hospitalWebsite:    hospitalWebsite || undefined,
        hospitalAddress:    hospitalAddress || undefined,
        hospitalState:      hospitalState || undefined,
        hospitalPincode:    hospitalPincode || undefined,
        hospitalLandmark:   hospitalLandmark || undefined,
        bloodBankAvailable: bloodBankAvailable !== undefined ? bloodBankAvailable : false,
        bloodStorageCapacity: bloodStorageCapacity || undefined,
        availableBloodGroups: Array.isArray(availableBloodGroups) ? availableBloodGroups : undefined,
        emergencyServiceAvailable: emergencyServiceAvailable !== undefined ? emergencyServiceAvailable : false,
        is24x7Service:      is24x7Service !== undefined ? is24x7Service : false,
        gstNumber:          gstNumber || undefined,
        hospitalLicenseCertificate: req.files?.hospitalLicenseCertificate
          ? parseFile(req.files.hospitalLicenseCertificate[0])
          : undefined,
        governmentApprovalDocument: req.files?.governmentApprovalDocument
          ? parseFile(req.files.governmentApprovalDocument[0])
          : undefined,
        adminIdProof: req.files?.adminIdProof
          ? parseFile(req.files.adminIdProof[0])
          : undefined,
        hospitalPhoto: req.files?.hospitalPhoto
          ? parseFile(req.files.hospitalPhoto[0])
          : undefined,
      });
    }

    const user = await User.create(payload);

    const token = generateToken(user._id.toString(), user.role);

    // Fire-and-forget welcome email
    sendWelcomeEmail(user);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return next(createError(401, 'Invalid email or password'));
    }
    if (!user.isActive) {
      return next(createError(401, 'Your account has been deactivated'));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(createError(401, 'Invalid email or password'));
    }

    const token = generateToken(user._id.toString(), user.role);

    res.json({
      message: 'Login successful',
      token,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return next(createError(404, 'User not found'));
    res.json({ user: safeUser(user) });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/auth/wallet ──────────────────────────────────────────────────────
export const updateWallet = async (req, res, next) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return next(createError(422, 'Invalid Ethereum wallet address'));
    }

    // Ensure wallet not already used by another account
    const existing = await User.findOne({
      walletAddress: walletAddress.toLowerCase(),
      _id: { $ne: req.user._id },
    });
    if (existing) {
      return next(createError(409, 'This wallet address is linked to another account'));
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { walletAddress: walletAddress.toLowerCase() },
      { new: true }
    );

    res.json({ message: 'Wallet address updated', walletAddress: user.walletAddress });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
export const updateProfile = async (req, res, next) => {
  try {
    const {
      name, city, lat, lng,
      age, weight, lastDonationDate,
      healthConditions, hospitalName, licenseNumber,

      // DONOR – Personal
      gender, dateOfBirth, mobileNumber, address, state, pincode,

      // DONOR – Medical
      hemoglobinLevel, currentMedications, allergies, surgeryHistory,
      smokingStatus, alcoholStatus, covidVaccinationStatus,

      // DONOR – Eligibility
      fitForDonation, governmentIdNumber, emergencyContactNumber,

      // HOSPITAL – Basic
      hospitalType, registrationNumber, establishedYear,

      // HOSPITAL – Contact
      contactPersonName, hospitalMobile, hospitalTelephone, hospitalWebsite,

      // HOSPITAL – Address
      hospitalAddress, hospitalState, hospitalPincode, hospitalLandmark,

      // HOSPITAL – Blood Bank
      bloodBankAvailable, bloodStorageCapacity, availableBloodGroups,
      emergencyServiceAvailable, is24x7Service,

      // HOSPITAL – Other
      gstNumber,
    } = req.body;

    const updates = {};

    // ── Original fields ──────────────────────────────────────
    if (name)    updates.name = name;
    if (age)     updates.age = age;
    if (weight)  updates.weight = weight;
    if (lastDonationDate) updates.lastDonationDate = new Date(lastDonationDate);
    if (healthConditions) updates.healthConditions = healthConditions;
    if (hospitalName)     updates.hospitalName = hospitalName;
    if (licenseNumber)    updates.licenseNumber = licenseNumber;

    if (city || lat || lng) {
      updates.location = {
        type:        'Point',
        coordinates: [parseFloat(lng) || req.user.location?.coordinates?.[0] || 0,
                      parseFloat(lat) || req.user.location?.coordinates?.[1] || 0],
        city:        city || req.user.location?.city || '',
      };
    }

    // ── DONOR – Personal ──────────────────────────────────────
    if (gender)        updates.gender = gender;
    if (dateOfBirth)   updates.dateOfBirth = new Date(dateOfBirth);
    if (mobileNumber)  updates.mobileNumber = mobileNumber;
    if (address)       updates.address = address;
    if (state)         updates.state = state;
    if (pincode)       updates.pincode = pincode;

    // ── DONOR – Medical ───────────────────────────────────────
    if (hemoglobinLevel !== undefined)      updates.hemoglobinLevel = hemoglobinLevel;
    if (currentMedications)                 updates.currentMedications = currentMedications;
    if (allergies)                          updates.allergies = allergies;
    if (surgeryHistory)                     updates.surgeryHistory = surgeryHistory;
    if (smokingStatus)                      updates.smokingStatus = smokingStatus;
    if (alcoholStatus)                      updates.alcoholStatus = alcoholStatus;
    if (covidVaccinationStatus)             updates.covidVaccinationStatus = covidVaccinationStatus;

    // ── DONOR – Eligibility ───────────────────────────────────
    if (fitForDonation !== undefined)       updates.fitForDonation = fitForDonation;
    if (governmentIdNumber)                 updates.governmentIdNumber = governmentIdNumber;
    if (emergencyContactNumber)             updates.emergencyContactNumber = emergencyContactNumber;

    if (req.files?.medicalReportCertificate) {
      updates.medicalReportCertificate = parseFile(req.files.medicalReportCertificate[0]);
    }
    if (req.files?.profilePhoto) {
      updates.profilePhoto = parseFile(req.files.profilePhoto[0]);
    }

    // ── HOSPITAL – Basic ──────────────────────────────────────
    if (hospitalType)       updates.hospitalType = hospitalType;
    if (registrationNumber) updates.registrationNumber = registrationNumber;
    if (establishedYear)    updates.establishedYear = establishedYear;

    // ── HOSPITAL – Contact ────────────────────────────────────
    if (contactPersonName)  updates.contactPersonName = contactPersonName;
    if (hospitalMobile)     updates.hospitalMobile = hospitalMobile;
    if (hospitalTelephone)  updates.hospitalTelephone = hospitalTelephone;
    if (hospitalWebsite)    updates.hospitalWebsite = hospitalWebsite;

    // ── HOSPITAL – Address ────────────────────────────────────
    if (hospitalAddress)    updates.hospitalAddress = hospitalAddress;
    if (hospitalState)      updates.hospitalState = hospitalState;
    if (hospitalPincode)    updates.hospitalPincode = hospitalPincode;
    if (hospitalLandmark)   updates.hospitalLandmark = hospitalLandmark;

    // ── HOSPITAL – Blood Bank ─────────────────────────────────
    if (bloodBankAvailable !== undefined)        updates.bloodBankAvailable = bloodBankAvailable;
    if (bloodStorageCapacity !== undefined)      updates.bloodStorageCapacity = bloodStorageCapacity;
    if (availableBloodGroups)                    updates.availableBloodGroups = availableBloodGroups;
    if (emergencyServiceAvailable !== undefined) updates.emergencyServiceAvailable = emergencyServiceAvailable;
    if (is24x7Service !== undefined)             updates.is24x7Service = is24x7Service;
    if (gstNumber)                               updates.gstNumber = gstNumber;

    if (req.files?.hospitalLicenseCertificate) {
      updates.hospitalLicenseCertificate = parseFile(req.files.hospitalLicenseCertificate[0]);
    }
    if (req.files?.governmentApprovalDocument) {
      updates.governmentApprovalDocument = parseFile(req.files.governmentApprovalDocument[0]);
    }
    if (req.files?.adminIdProof) {
      updates.adminIdProof = parseFile(req.files.adminIdProof[0]);
    }
    if (req.files?.hospitalPhoto) {
      updates.hospitalPhoto = parseFile(req.files.hospitalPhoto[0]);
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new:           true,
      runValidators: true,
    });

    res.json({ message: 'Profile updated successfully', user: safeUser(user) });
  } catch (err) {
    next(err);
  }
};