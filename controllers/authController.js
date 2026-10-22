// Register/login/logout/session endpoints. The JWT travels only in an httpOnly cookie.
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HttpError } = require('../utils/httpError');
const { toCleanString } = require('../utils/sanitize');
const {
  AUTH_COOKIE_NAME,
  ROLES,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} = require('../config/constants');
const {
  IS_PRODUCTION,
  JWT_SECRET,
  JWT_EXPIRES_IN_SECONDS,
  BCRYPT_SALT_ROUNDS,
} = require('../config/env');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 80;
const ADMIN_PORTAL = 'admin';
const ADMIN_PORTAL_ROLES = [ROLES.ADMIN, ROLES.STORE_OWNER];

function cookieOptions() {
  return { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'strict', path: '/' };
}

function toPublicUser(user) {
  return {
    _id: user._id,
    email: user.email,
    name: user.name ?? '',
    role: user.role,
    store_id: user.store_id ?? null,
    must_change_password: Boolean(user.must_change_password),
    created_at: user.created_at,
  };
}

function startSession(res, user) {
  const token = jwt.sign({ sub: String(user._id), role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN_SECONDS,
  });
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: JWT_EXPIRES_IN_SECONDS * 1000,
  });
}

/** POST /api/auth/register: creates a reader account and starts its session. */
async function register(req, res) {
  const name = toCleanString(req.body?.name, MAX_NAME_LENGTH);
  const email = toCleanString(req.body?.email, 254)?.toLowerCase();
  const password = req.body?.password;
  if (!name) throw new HttpError(400, 'Name is required');
  if (!email || !EMAIL_PATTERN.test(email)) throw new HttpError(400, 'A valid email is required');
  if (
    typeof password !== 'string' ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new HttpError(400, `Password must have at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (await User.exists({ email })) throw new HttpError(409, 'Email is already registered');

  const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  let user;
  try {
    user = await User.create({ name, email, password_hash, role: ROLES.READER });
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(409, 'Email is already registered');
    throw error;
  }

  startSession(res, user);
  res.status(201).json({ user: toPublicUser(user) });
}

/**
 * POST /api/auth/login. With `portal: "admin"` only administrators and store owners
 * may sign in, so the admin access screen never opens a reader session.
 */
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
  if (req.body?.portal === ADMIN_PORTAL && !ADMIN_PORTAL_ROLES.includes(user.role)) {
    throw new HttpError(403, 'This account is not an administrator or store owner');
  }

  startSession(res, user);
  res.json({ user: toPublicUser(user) });
}

/** POST /api/auth/logout */
function logout(req, res) {
  res.clearCookie(AUTH_COOKIE_NAME, cookieOptions());
  res.status(204).end();
}

/** GET /api/auth/me (requireSession runs first, so it works while a password change is pending) */
function me(req, res) {
  res.json({ user: toPublicUser(req.user) });
}

/** PATCH /api/auth/me (requireAuth runs first): lets the signed-in user rename themselves. */
async function updateMe(req, res) {
  const name = toCleanString(req.body?.name, MAX_NAME_LENGTH);
  if (!name) throw new HttpError(400, 'Name is required');

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name },
    {
      new: true,
      runValidators: true,
      projection: 'email name role store_id must_change_password created_at',
    }
  ).lean();
  if (!user) throw new HttpError(401, 'Invalid or expired session');
  res.json({ user: toPublicUser(user) });
}

/**
 * PATCH /api/auth/password body { current_password, new_password } (requireSession runs first).
 * Clears `must_change_password`, so a store owner can leave the forced-change screen.
 */
async function changePassword(req, res) {
  const currentPassword = req.body?.current_password;
  const newPassword = req.body?.new_password;
  if (
    typeof currentPassword !== 'string' ||
    !currentPassword ||
    currentPassword.length > MAX_PASSWORD_LENGTH
  ) {
    throw new HttpError(400, 'Current password is required');
  }
  if (
    typeof newPassword !== 'string' ||
    newPassword.length < MIN_PASSWORD_LENGTH ||
    newPassword.length > MAX_PASSWORD_LENGTH
  ) {
    throw new HttpError(400, `Password must have at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (newPassword === currentPassword) {
    throw new HttpError(400, 'New password must be different from the current one');
  }

  const user = await User.findById(req.user._id).select('+password_hash');
  if (!user) throw new HttpError(401, 'Invalid or expired session');
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw new HttpError(400, 'Current password is incorrect');
  }

  user.password_hash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  user.must_change_password = false;
  await user.save();
  res.json({ user: toPublicUser(user) });
}

module.exports = { register, login, logout, me, updateMe, changePassword };
