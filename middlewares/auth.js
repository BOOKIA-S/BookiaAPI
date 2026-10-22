// Authentication (JWT cookie) and role-based authorization middlewares.
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/env');
const { AUTH_COOKIE_NAME, PASSWORD_CHANGE_REQUIRED } = require('../config/constants');
const { HttpError } = require('../utils/httpError');
const { isValidObjectId } = require('../utils/sanitize');

const SESSION_FIELDS = 'email name role store_id must_change_password created_at';

/**
 * Verifies the JWT cookie and attaches
 * `req.user = { _id, email, name, role, store_id, must_change_password, created_at }`.
 */
async function loadSessionUser(req) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) throw new HttpError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Invalid or expired session');
  }
  if (!isValidObjectId(payload?.sub)) throw new HttpError(401, 'Invalid or expired session');

  const user = await User.findById(payload.sub, SESSION_FIELDS).lean();
  if (!user) throw new HttpError(401, 'Invalid or expired session');

  req.user = {
    _id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    store_id: user.store_id ?? null,
    must_change_password: Boolean(user.must_change_password),
    created_at: user.created_at,
  };
}

/**
 * Authenticates without enforcing the pending password change. Only the routes that let
 * the user finish it (GET /me, PATCH /password) use this directly.
 */
async function requireSession(req, res, next) {
  await loadSessionUser(req);
  next();
}

/** Authenticates and rejects with 403 PASSWORD_CHANGE_REQUIRED while the password is pending. */
async function requireAuth(req, res, next) {
  await loadSessionUser(req);
  if (req.user.must_change_password) {
    throw new HttpError(403, 'You must change your password first', PASSWORD_CHANGE_REQUIRED);
  }
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

module.exports = { requireSession, requireAuth, requireRole };
