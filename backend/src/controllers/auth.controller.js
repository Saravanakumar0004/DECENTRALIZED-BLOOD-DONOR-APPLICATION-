import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import { sendWelcomeEmail } from '../utils/sendEmail.js';
import { createError } from '../utils/errors.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  lastDonationDate: user.lastDonationDate,
  healthConditions: user.healthConditions,
  hospitalName:     user.hospitalName,
  licenseNumber:    user.licenseNumber,
  createdAt:    user.createdAt,
});

// ── POST /api/auth/register ──────────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const {
      name, email, password, role,
      bloodGroup, city, lat, lng,
      walletAddress, hospitalName, licenseNumber,
      age, weight,
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

    const user = await User.create({
      name,
      email,
      password,
      role,
      bloodGroup:    role === 'DONOR' ? bloodGroup : undefined,
      hospitalName:  role === 'HOSPITAL' ? hospitalName : undefined,
      licenseNumber: role === 'HOSPITAL' ? licenseNumber : undefined,
      age:           age || undefined,
      weight:        weight || undefined,
      walletAddress: walletAddress || undefined,
      location: {
        type:        'Point',
        coordinates: [parseFloat(lng) || 0, parseFloat(lat) || 0],
        city:        city || '',
      },
    });

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

// ── POST /api/auth/login ─────────────────────────────────────────────────────
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

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return next(createError(404, 'User not found'));
    res.json({ user: safeUser(user) });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/auth/wallet ─────────────────────────────────────────────────────
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

// ── PUT /api/auth/profile ────────────────────────────────────────────────────
export const updateProfile = async (req, res, next) => {
  try {
    const {
      name, city, lat, lng,
      age, weight, lastDonationDate,
      healthConditions, hospitalName, licenseNumber,
    } = req.body;

    // Build update object — only set fields that were provided
    const updates = {};
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

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new:          true,
      runValidators: true,
    });

    res.json({ message: 'Profile updated successfully', user: safeUser(user) });
  } catch (err) {
    next(err);
  }
};
