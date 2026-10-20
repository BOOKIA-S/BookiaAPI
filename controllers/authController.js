// Login/logout/session endpoints. The JWT travels only in an httpOnly cookie.
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HttpError } = require('../utils/httpError');
const { toCleanString } = require('../utils/sanitize');
const { AUTH_COOKIE_NAME } = require('../config/constants');
const { IS_PRODUCTION, JWT_SECRET, JWT_EXPIRES_IN_SECONDS } = require('../config/env');

const MAX_PASSWORD_LENGTH = 200;

function cookieOptions() {
  return { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'strict', path: '/' };
}

function toPublicUser(user) {
  return { _id: user._id, email: user.email, role: user.role };
}

/** POST /api/auth/login */
async function login(req, res) {
  const email = toCleanString(req.body?.email, 254)?.toLowerCase();
  const password = req.body?.password;
  if (
    !email ||
    typeof password !== 'string' ||
    !password ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new HttpError(400, 'Email and password are required');
  }

  const user = await User.findOne({ email }).select('+password_hash');
  const isValid = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!isValid) throw new HttpError(401, 'Invalid email or password');

  const token = jwt.sign({ sub: String(user._id), role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN_SECONDS,
  });
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: JWT_EXPIRES_IN_SECONDS * 1000,
  });
  res.json({ user: toPublicUser(user) });
}

/** POST /api/auth/logout */
function logout(req, res) {
  res.clearCookie(AUTH_COOKIE_NAME, cookieOptions());
  res.status(204).end();
}

/** GET /api/auth/me (requireAuth runs first) */
function me(req, res) {
  res.json({ user: toPublicUser(req.user) });
}

module.exports = { login, logout, me };
