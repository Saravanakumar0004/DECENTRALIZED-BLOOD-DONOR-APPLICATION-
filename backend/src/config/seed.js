/**
 * Seed script — populates the DB with sample data for development.
 * Run: npm run seed
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import BloodRequest from '../models/BloodRequest.js';
import logger from '../utils/logger.js';

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  logger.info('Connected to MongoDB for seeding...');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    BloodRequest.deleteMany({}),
  ]);
  logger.info('Cleared existing data');

  // ── Create Users ─────────────────────────────────────────────────────────
  const admin = await User.create({
    name:       'BloodLink Admin',
    email:      'admin@bloodlink.io',
    password:   'Admin@1234',
    role:       'ADMIN',
    isVerified: true,
    location:   { type: 'Point', coordinates: [80.2707, 13.0827], city: 'Chennai' },
  });

  const hospital1 = await User.create({
    name:          'Apollo Hospitals',
    email:         'apollo@bloodlink.io',
    password:      'Hospital@1234',
    role:          'HOSPITAL',
    hospitalName:  'Apollo Hospitals Chennai',
    licenseNumber: 'TN-HOSP-001',
    isVerified:    true,
    location:      { type: 'Point', coordinates: [80.2707, 13.0625], city: 'Chennai' },
  });

  const hospital2 = await User.create({
    name:          'MIOT International',
    email:         'miot@bloodlink.io',
    password:      'Hospital@1234',
    role:          'HOSPITAL',
    hospitalName:  'MIOT International Hospital',
    licenseNumber: 'TN-HOSP-002',
    isVerified:    true,
    location:      { type: 'Point', coordinates: [80.2124, 13.0358], city: 'Chennai' },
  });

  const donor1 = await User.create({
    name:        'Arun Kumar',
    email:       'arun@bloodlink.io',
    password:    'Donor@1234',
    role:        'DONOR',
    bloodGroup:  'O+',
    age:         28,
    weight:      72,
    isVerified:  true,
    walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    location:    { type: 'Point', coordinates: [80.2785, 13.0900], city: 'Chennai' },
  });

  const donor2 = await User.create({
    name:        'Priya Rajan',
    email:       'priya@bloodlink.io',
    password:    'Donor@1234',
    role:        'DONOR',
    bloodGroup:  'A+',
    age:         25,
    weight:      58,
    isVerified:  true,
    location:    { type: 'Point', coordinates: [80.2500, 13.0600], city: 'Chennai' },
  });

  const donor3 = await User.create({
    name:        'Karthik S',
    email:       'karthik@bloodlink.io',
    password:    'Donor@1234',
    role:        'DONOR',
    bloodGroup:  'B-',
    age:         32,
    weight:      80,
    isVerified:  true,
    location:    { type: 'Point', coordinates: [80.2600, 13.1000], city: 'Chennai' },
  });

  logger.info(`Created ${6} users`);

  // ── Create Blood Requests ─────────────────────────────────────────────────
  await BloodRequest.insertMany([
    {
      hospital:      hospital1._id,
      bloodGroup:    'O+',
      unitsRequired: 2,
      urgencyLevel:  'Critical',
      location:      { type: 'Point', coordinates: [80.2707, 13.0625], city: 'Chennai' },
      notes:         'Urgent surgery patient in ICU',
    },
    {
      hospital:      hospital1._id,
      bloodGroup:    'A+',
      unitsRequired: 1,
      urgencyLevel:  'High',
      location:      { type: 'Point', coordinates: [80.2707, 13.0625], city: 'Chennai' },
      notes:         'Required for scheduled procedure',
    },
    {
      hospital:      hospital2._id,
      bloodGroup:    'B-',
      unitsRequired: 3,
      urgencyLevel:  'Critical',
      location:      { type: 'Point', coordinates: [80.2124, 13.0358], city: 'Chennai' },
      notes:         'Rare blood type — emergency',
    },
    {
      hospital:      hospital2._id,
      bloodGroup:    'AB+',
      unitsRequired: 1,
      urgencyLevel:  'Medium',
      location:      { type: 'Point', coordinates: [80.2124, 13.0358], city: 'Chennai' },
    },
    {
      hospital:      hospital1._id,
      bloodGroup:    'O-',
      unitsRequired: 2,
      urgencyLevel:  'High',
      location:      { type: 'Point', coordinates: [80.2707, 13.0625], city: 'Chennai' },
      notes:         'Universal donor blood needed for emergency dept',
    },
  ]);

  logger.info('Created 5 blood requests');

  logger.info('\n─── Seed Complete ───');
  logger.info('Login credentials:');
  logger.info('  Admin:     admin@bloodlink.io     / Admin@1234');
  logger.info('  Hospital1: apollo@bloodlink.io    / Hospital@1234');
  logger.info('  Hospital2: miot@bloodlink.io      / Hospital@1234');
  logger.info('  Donor1:    arun@bloodlink.io      / Donor@1234  (O+)');
  logger.info('  Donor2:    priya@bloodlink.io     / Donor@1234  (A+)');
  logger.info('  Donor3:    karthik@bloodlink.io   / Donor@1234  (B-)');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
