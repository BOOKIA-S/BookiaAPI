// Single place that shapes offers for API responses and computes stock aggregates.
// `is_available` is derived (stock > 0) and never stored.
const { HttpError } = require('./httpError');
const { toNumber } = require('./sanitize');

/** @returns {number} the offer's stock as a non-negative number (missing -> 0). */
function stockOf(offer) {
  const stock = Number(offer?.stock);
  return Number.isFinite(stock) && stock > 0 ? stock : 0;
}

/** @returns {boolean} true when the offer has at least one copy in stock. */
function isInStock(offer) {
  return stockOf(offer) > 0;
}

/**
 * Returns a plain copy of an offer (Mongoose document or lean object) with
 * `stock` and the derived read-only `is_available`.
 */
function withAvailability(offer) {
  const plain = typeof offer?.toObject === 'function' ? offer.toObject() : { ...offer };
  const stock = stockOf(plain);
  return { ...plain, stock, is_available: stock > 0 };
}

/** Lowest price among offers with stock > 0, or null when none is in stock. */
function computeMinPrice(offers) {
  const prices = offers.filter(isInStock).map((offer) => offer.price);
  return prices.length > 0 ? Math.min(...prices) : null;
}

/** Sum of stock over the given offers. */
function computeTotalStock(offers) {
  return offers.reduce((total, offer) => total + stockOf(offer), 0);
}

/**
 * Validates an incoming stock value (number or numeric string).
 * @returns {number|undefined} the parsed integer, or undefined when not provided.
 * @throws {HttpError} 400 when it is not a non-negative integer.
 */
function parseStock(value) {
  if (value === undefined) return undefined;
  const parsed = toNumber(value);
  if (parsed === undefined || !Number.isInteger(parsed) || parsed < 0) {
    throw new HttpError(400, 'stock must be a non-negative integer');
  }
  return parsed;
}

module.exports = {
  isInStock,
  withAvailability,
  computeMinPrice,
  computeTotalStock,
  parseStock,
};
