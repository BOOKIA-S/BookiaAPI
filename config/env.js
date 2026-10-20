// Loads environment variables once and exposes them as typed constants.
require('dotenv').config({ quiet: true });

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_TEST = NODE_ENV === 'test';
const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN_SECONDS = Number(process.env.JWT_EXPIRES_IN_SECONDS) || 8 * 60 * 60;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const BCRYPT_SALT_ROUNDS = Math.max(Number(process.env.BCRYPT_SALT_ROUNDS) || 12, 10);

/**
 * Throws if any of the given environment variables is missing or empty.
 * @param {string[]} names
 */
function assertRequiredEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
  NODE_ENV,
  IS_PRODUCTION,
  IS_TEST,
  PORT,
  MONGODB_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN_SECONDS,
  CLIENT_URL,
  BCRYPT_SALT_ROUNDS,
  assertRequiredEnv,
};
