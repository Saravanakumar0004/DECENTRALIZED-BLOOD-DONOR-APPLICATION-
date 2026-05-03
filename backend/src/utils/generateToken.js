import jwt from 'jsonwebtoken';

/**
 * generateToken — signs a JWT containing the user's id and role.
 * @param {string} id   — MongoDB ObjectId as string
 * @param {string} role — User role: DONOR | HOSPITAL | ADMIN
 * @returns {string} signed JWT
 */
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export default generateToken;
