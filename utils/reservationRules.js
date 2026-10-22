// Reservation statuses, lifecycle rules and limits, shared by the model and controller.
const RESERVATION_STATUSES = Object.freeze({
  PENDING: 'pendiente',
  CONFIRMED: 'confirmada',
  DELIVERED: 'entregada',
  CANCELLED: 'cancelada',
  EXPIRED: 'vencida',
});

// Statuses that still hold copies out of the offer's stock.
const ACTIVE_STATUSES = Object.freeze([
  RESERVATION_STATUSES.PENDING,
  RESERVATION_STATUSES.CONFIRMED,
]);

// Statuses that give the copies back to the offer when reached.
const RELEASING_STATUSES = Object.freeze([
  RESERVATION_STATUSES.CANCELLED,
  RESERVATION_STATUSES.EXPIRED,
]);

// Status a store manager may set -> statuses it may be set from.
const MANAGER_TRANSITIONS = Object.freeze({
  [RESERVATION_STATUSES.CONFIRMED]: [RESERVATION_STATUSES.PENDING],
  [RESERVATION_STATUSES.DELIVERED]: ACTIVE_STATUSES,
  [RESERVATION_STATUSES.CANCELLED]: ACTIVE_STATUSES,
});

const RESERVATION_TTL_MS = 48 * 60 * 60 * 1000;
const MAX_RESERVATION_QUANTITY = 5;
const MAX_ACTIVE_RESERVATIONS = 10;
const EXPIRY_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** @returns {Date} the pick-up deadline for a reservation made at `now`. */
function expiryFrom(now = new Date()) {
  return new Date(now.getTime() + RESERVATION_TTL_MS);
}

module.exports = {
  RESERVATION_STATUSES,
  ACTIVE_STATUSES,
  RELEASING_STATUSES,
  MANAGER_TRANSITIONS,
  RESERVATION_TTL_MS,
  MAX_RESERVATION_QUANTITY,
  MAX_ACTIVE_RESERVATIONS,
  EXPIRY_SWEEP_INTERVAL_MS,
  expiryFrom,
};
