// Helpers that turn untrusted request input into safe, typed query values.
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

/** @returns {boolean} true when value is a 24-char hex ObjectId string. */
function isValidObjectId(value) {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}

/** Escapes every regex metacharacter so user input matches literally. */
function escapeRegex(value) {
  return String(value).replace(REGEX_SPECIAL_CHARS, '\\$&');
}

/** Returns a trimmed, length-capped string, or undefined for non-strings/empty strings. */
function toCleanString(value, maxLength = 200) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

/** Parses a finite number from a string or number, otherwise undefined. */
function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Parses a positive integer capped at max, falling back when invalid. */
function toPositiveInt(value, fallback, max) {
  const parsed = toNumber(value);
  if (parsed === undefined || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

/** Copies only whitelisted own properties from source. */
function pickFields(source, fields) {
  const result = {};
  if (!source || typeof source !== 'object') return result;
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field];
    }
  }
  return result;
}

/** Recursively removes keys that start with "$" or contain "." (NoSQL operator injection). */
function stripOperators(value) {
  if (Array.isArray(value)) return value.map(stripOperators);
  if (!value || typeof value !== 'object') return value;
  const clean = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    clean[key] = stripOperators(nested);
  }
  return clean;
}

module.exports = {
  isValidObjectId,
  escapeRegex,
  toCleanString,
  toNumber,
  toPositiveInt,
  pickFields,
  stripOperators,
};
