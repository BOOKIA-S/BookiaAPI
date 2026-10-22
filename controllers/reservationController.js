// Reservations: a reader sets aside copies of an offer; the store (or the admin) handles them.
const Reservation = require('../models/Reservation');
const Offer = require('../models/Offer');
const { HttpError } = require('../utils/httpError');
const { isValidObjectId, toNumber } = require('../utils/sanitize');
const { ROLES } = require('../config/constants');
const {
  RESERVATION_STATUSES,
  ACTIVE_STATUSES,
  RELEASING_STATUSES,
  MANAGER_TRANSITIONS,
  STORE_OWNER_ROLE,
  MAX_RESERVATION_QUANTITY,
  MAX_ACTIVE_RESERVATIONS,
  expiryFrom,
} = require('../utils/reservationRules');

const POPULATE_BOOK = { path: 'book_id', select: 'title author' };
const POPULATE_STORE = { path: 'store_id', select: 'name address phone schedule' };
const POPULATE_USER = { path: 'user_id', select: 'name email' };
const MAX_LISTED = 200;

/** Turns `{ book_id: {...} }` style populated refs into `{ book_id, book }` for the client. */
function toView(reservation) {
  const plain =
    typeof reservation?.toObject === 'function' ? reservation.toObject() : { ...reservation };
  const view = { ...plain };
  for (const [field, key] of [
    ['book_id', 'book'],
    ['store_id', 'store'],
    ['user_id', 'user'],
  ]) {
    const value = plain[field];
    if (value && typeof value === 'object' && value._id) {
      view[field] = value._id;
      view[key] = value;
    }
  }
  return view;
}

/** Gives the copies of a reservation back to its offer (no-op if the offer was deleted). */
async function releaseStock(reservation) {
  await Offer.updateOne({ _id: reservation.offer_id }, { $inc: { stock: reservation.quantity } });
}

/**
 * Atomically moves a reservation from one of `fromStatuses` to `status`, releasing its
 * stock when the new status gives copies back. Returns null when it was not in `fromStatuses`.
 */
async function transition(filter, fromStatuses, status) {
  const reservation = await Reservation.findOneAndUpdate(
    { ...filter, status: { $in: fromStatuses } },
    { $set: { status } },
    { returnDocument: 'after' }
  );
  if (reservation && RELEASING_STATUSES.includes(status)) await releaseStock(reservation);
  return reservation;
}

/**
 * Lazy expiry: marks overdue active reservations matching `filter` as expired and
 * returns their copies to stock. Also run periodically by the server.
 * @returns {Promise<number>} how many reservations expired.
 */
async function expireOverdue(filter = {}, now = new Date()) {
  const overdue = await Reservation.find(
    { ...filter, status: { $in: ACTIVE_STATUSES }, expires_at: { $lte: now } },
    '_id'
  ).lean();
  let expired = 0;
  for (const { _id } of overdue) {
    const reservation = await transition({ _id }, ACTIVE_STATUSES, RESERVATION_STATUSES.EXPIRED);
    if (reservation) expired += 1;
  }
  return expired;
}

/** Parses the requested quantity (default 1). */
function parseQuantity(value) {
  if (value === undefined) return 1;
  const parsed = toNumber(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_RESERVATION_QUANTITY) {
    throw new HttpError(400, `quantity must be an integer from 1 to ${MAX_RESERVATION_QUANTITY}`);
  }
  return parsed;
}

/** POST /api/reservations body { offer_id, quantity? } -> 201 reservation */
async function createReservation(req, res) {
  const { offer_id: offerId } = req.body ?? {};
  if (!isValidObjectId(offerId)) throw new HttpError(400, 'Invalid offer_id');
  const quantity = parseQuantity(req.body.quantity);

  await expireOverdue({ user_id: req.user._id });
  const active = await Reservation.countDocuments({
    user_id: req.user._id,
    status: { $in: ACTIVE_STATUSES },
  });
  if (active >= MAX_ACTIVE_RESERVATIONS) {
    throw new HttpError(400, `You can have up to ${MAX_ACTIVE_RESERVATIONS} active reservations`);
  }

  // Free copies held by overdue reservations of this offer before checking stock.
  await expireOverdue({ offer_id: offerId });
  // Atomic: only decrements when enough copies remain, so stock never goes negative.
  const offer = await Offer.findOneAndUpdate(
    { _id: offerId, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { returnDocument: 'after' }
  ).lean();
  if (!offer) {
    if (!(await Offer.exists({ _id: offerId }))) throw new HttpError(404, 'Offer not found');
    throw new HttpError(409, 'Not enough copies available');
  }

  let reservation;
  try {
    reservation = await Reservation.create({
      user_id: req.user._id,
      offer_id: offer._id,
      store_id: offer.store_id,
      book_id: offer.book_id,
      price: offer.price,
      quantity,
      status: RESERVATION_STATUSES.PENDING,
      expires_at: expiryFrom(),
    });
  } catch (error) {
    await releaseStock({ offer_id: offer._id, quantity });
    throw error;
  }
  res.status(201).json(toView(reservation));
}

/** GET /api/reservations/mine -> { items } (most recent first) */
async function listMyReservations(req, res) {
  await expireOverdue({ user_id: req.user._id });
  const items = await Reservation.find({ user_id: req.user._id })
    .sort({ created_at: -1 })
    .limit(MAX_LISTED)
    .populate(POPULATE_BOOK)
    .populate(POPULATE_STORE)
    .lean();
  res.json({ items: items.map(toView) });
}

/** PATCH /api/reservations/:id/cancel -> reservation (reader cancels their own) */
async function cancelMyReservation(req, res) {
  const filter = { _id: req.params.id, user_id: req.user._id };
  await expireOverdue(filter);
  const reservation = await transition(filter, ACTIVE_STATUSES, RESERVATION_STATUSES.CANCELLED);
  if (!reservation) {
    if (!(await Reservation.exists(filter))) throw new HttpError(404, 'Reservation not found');
    throw new HttpError(409, 'Only pending or confirmed reservations can be cancelled');
  }
  res.json(toView(reservation));
}

/**
 * Restricts a query to what the signed-in manager may see:
 * admins see every store, store owners only their own.
 */
function managerScope(user) {
  if (user.role === ROLES.ADMIN) return {};
  if (user.role === STORE_OWNER_ROLE && user.store_id) return { store_id: user.store_id };
  throw new HttpError(403, 'Forbidden');
}

/** GET /api/reservations/manage?status=&store_id= -> { items } */
async function listManagedReservations(req, res) {
  const scope = managerScope(req.user);
  const filter = { ...scope };
  const { status, store_id: storeId } = req.query;
  if (status !== undefined) {
    if (!Object.values(RESERVATION_STATUSES).includes(status)) {
      throw new HttpError(400, 'Invalid status');
    }
    filter.status = status;
  }
  if (storeId !== undefined && !scope.store_id) {
    if (!isValidObjectId(storeId)) throw new HttpError(400, 'Invalid store_id');
    filter.store_id = storeId;
  }

  await expireOverdue(scope);
  const items = await Reservation.find(filter)
    .sort({ created_at: -1 })
    .limit(MAX_LISTED)
    .populate(POPULATE_BOOK)
    .populate(POPULATE_STORE)
    .populate(POPULATE_USER)
    .lean();
  res.json({ items: items.map(toView) });
}

/** PATCH /api/reservations/:id/status body { status } -> reservation */
async function updateReservationStatus(req, res) {
  const scope = managerScope(req.user);
  const { status } = req.body ?? {};
  const fromStatuses = MANAGER_TRANSITIONS[status];
  if (!fromStatuses) {
    throw new HttpError(
      400,
      `status must be one of: ${Object.keys(MANAGER_TRANSITIONS).join(', ')}`
    );
  }

  const filter = { ...scope, _id: req.params.id };
  await expireOverdue(filter);
  const reservation = await transition(filter, fromStatuses, status);
  if (!reservation) {
    if (!(await Reservation.exists(filter))) throw new HttpError(404, 'Reservation not found');
    throw new HttpError(409, `Reservation cannot change to ${status} from its current status`);
  }
  res.json(toView(reservation));
}

module.exports = {
  createReservation,
  listMyReservations,
  cancelMyReservation,
  listManagedReservations,
  updateReservationStatus,
  expireOverdue,
};
