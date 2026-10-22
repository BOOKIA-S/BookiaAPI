// Store owner accounts: the general admin creates them and assigns each one to a store.
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Store = require('../models/Store');
const { HttpError } = require('../utils/httpError');
const { logAudit } = require('../utils/auditLogger');
const { isValidObjectId, toCleanString } = require('../utils/sanitize');
const {
  ROLES,
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} = require('../config/constants');
const { BCRYPT_SALT_ROUNDS } = require('../config/env');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 80;
const USER_FIELDS = 'email name role store_id must_change_password created_at';
const OWNER_FILTER = { role: ROLES.STORE_OWNER };

function toOwnerView(user) {
  const store = user.store_id && typeof user.store_id === 'object' ? user.store_id : null;
  return {
    _id: user._id,
    email: user.email,
    name: user.name ?? '',
    role: user.role,
    store_id: store?._id ?? user.store_id ?? null,
    store: store?.name ? { _id: store._id, name: store.name } : null,
    must_change_password: Boolean(user.must_change_password),
    created_at: user.created_at,
  };
}

/** Validates that `value` is the id of an existing store. */
async function assertStoreExists(value) {
  if (!isValidObjectId(value)) throw new HttpError(400, 'A valid store_id is required');
  if (!(await Store.exists({ _id: value }))) throw new HttpError(400, 'Store does not exist');
  return value;
}

async function loadOwnerView(id) {
  const user = await User.findOne({ _id: id, ...OWNER_FILTER }, USER_FIELDS)
    .populate('store_id', 'name')
    .lean();
  if (!user) throw new HttpError(404, 'Store owner not found');
  return toOwnerView(user);
}

/** GET /api/users -> { items } (store owner accounts, sorted by email) */
async function listStoreOwners(req, res) {
  const users = await User.find(OWNER_FILTER, USER_FIELDS)
    .sort({ email: 1 })
    .populate('store_id', 'name')
    .lean();
  res.json({ items: users.map(toOwnerView) });
}

/** POST /api/users body { name, email, password, store_id } -> 201 { user } */
async function createStoreOwner(req, res) {
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
  const store_id = await assertStoreExists(req.body?.store_id);
  if (await User.exists({ email })) throw new HttpError(409, 'Email is already registered');

  const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  let user;
  try {
    user = await User.create({
      name,
      email,
      password_hash,
      role: ROLES.STORE_OWNER,
      store_id,
      must_change_password: true,
    });
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(409, 'Email is already registered');
    throw error;
  }
  await logAudit(req.user, AUDIT_ACTIONS.CREATE, AUDIT_ENTITIES.USER, user._id);
  res.status(201).json({ user: await loadOwnerView(user._id) });
}

/** PATCH /api/users/:id body { store_id?, name? } -> { user } */
async function updateStoreOwner(req, res) {
  const update = {};
  if (req.body?.store_id !== undefined) {
    update.store_id = await assertStoreExists(req.body.store_id);
  }
  if (req.body?.name !== undefined) {
    const name = toCleanString(req.body.name, MAX_NAME_LENGTH);
    if (!name) throw new HttpError(400, 'Name is required');
    update.name = name;
  }

  const user = await User.findOneAndUpdate({ _id: req.params.id, ...OWNER_FILTER }, update, {
    returnDocument: 'after',
    runValidators: true,
    projection: '_id',
  }).lean();
  if (!user) throw new HttpError(404, 'Store owner not found');
  await logAudit(req.user, AUDIT_ACTIONS.UPDATE, AUDIT_ENTITIES.USER, user._id);
  res.json({ user: await loadOwnerView(user._id) });
}

/** DELETE /api/users/:id -> 204 (store owner accounts only) */
async function deleteStoreOwner(req, res) {
  const user = await User.findOneAndDelete({ _id: req.params.id, ...OWNER_FILTER });
  if (!user) throw new HttpError(404, 'Store owner not found');
  await logAudit(req.user, AUDIT_ACTIONS.DELETE, AUDIT_ENTITIES.USER, user._id);
  res.status(204).end();
}

module.exports = { listStoreOwners, createStoreOwner, updateStoreOwner, deleteStoreOwner };
