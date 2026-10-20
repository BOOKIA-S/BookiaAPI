// Authentication (JWT cookie) and role-based authorization middlewares.
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/env');
const { AUTH_COOKIE_NAME } = require('../config/constants');
const { HttpError } = require('../utils/httpError');
const { isValidObjectId } = require('../utils/sanitize');

/** Verifies the JWT cookie and attaches `req.user = { _id, email, name, role }`. */
async function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) throw new HttpError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Invalid or expired session');
  }
  if (!isValidObjectId(payload?.sub)) throw new HttpError(401, 'Invalid or expired session');

  const user = await User.findById(payload.sub, 'email name role').lean();
  if (!user) throw new HttpError(401, 'Invalid or expired session');

  req.user = { _id: user._id, email: user.email, name: user.name, role: user.role };
  next();
}

/**
 * Allows the request only when the authenticated user has one of the roles.
 * @param {...string} roles
 */
function requireRole(...roles) {
  return function checkRole(req, res, next) {
    if (!req.user) return next(new HttpError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Forbidden'));
    return next();
  };
}

module.exports = { requireAuth, requireRole };
