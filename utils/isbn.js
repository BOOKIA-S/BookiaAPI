// ISBN helpers for the exact `?isbn=` lookup (e.g. a barcode scanned by the mobile app).
const ISBN10_PATTERN = /^\d{9}[\dX]$/;
const ISBN13_PATTERN = /^97[89]\d{10}$/;

/** Removes dashes and spaces and upper-cases X; returns undefined for non-strings. */
function normalizeIsbn(value) {
  if (typeof value !== 'string') return undefined;
  return value.replace(/[\s-]/g, '').toUpperCase();
}

/** True when the normalized value is a well-formed ISBN-10 or ISBN-13 (check digit included). */
function isValidIsbn(isbn) {
  if (ISBN10_PATTERN.test(isbn)) {
    const sum = [...isbn].reduce(
      (acc, char, index) => acc + (char === 'X' ? 10 : Number(char)) * (10 - index),
      0
    );
    return sum % 11 === 0;
  }
  if (ISBN13_PATTERN.test(isbn)) {
    const sum = [...isbn].reduce((acc, char, index) => acc + Number(char) * (index % 2 ? 3 : 1), 0);
    return sum % 10 === 0;
  }
  return false;
}

function isbn10CheckDigit(first9) {
  const sum = [...first9].reduce((acc, char, index) => acc + Number(char) * (10 - index), 0);
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? 'X' : String(check);
}

function isbn13CheckDigit(first12) {
  const sum = [...first12].reduce(
    (acc, char, index) => acc + Number(char) * (index % 2 ? 3 : 1),
    0
  );
  return String((10 - (sum % 10)) % 10);
}

/**
 * Returns the equivalent forms of a valid normalized ISBN: itself plus its ISBN-10/13
 * counterpart when one exists (only 978-prefixed ISBN-13 have an ISBN-10).
 */
function isbnVariants(isbn) {
  if (isbn.length === 10) {
    const isbn13 = `978${isbn.slice(0, 9)}`;
    return [isbn, isbn13 + isbn13CheckDigit(isbn13)];
  }
  if (isbn.startsWith('978')) {
    const first9 = isbn.slice(3, 12);
    return [isbn, first9 + isbn10CheckDigit(first9)];
  }
  return [isbn];
}

/** Regex matching a stored ISBN equal to `isbn` regardless of where its dashes are. */
function isbnStoredPattern(isbn) {
  const body = [...isbn].join('-*'); // only digits and X, nothing to escape
  return new RegExp(`^-*${body}-*$`, 'i');
}

module.exports = { normalizeIsbn, isValidIsbn, isbnVariants, isbnStoredPattern };
