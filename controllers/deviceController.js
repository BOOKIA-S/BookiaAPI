// Push notification devices: the mobile app registers its FCM token after signing in
// and removes it when signing out.
const Device = require('../models/Device');
const { HttpError } = require('../utils/httpError');
const { DEVICE_PLATFORMS, MAX_DEVICE_TOKEN_LENGTH } = require('../config/constants');

const PLATFORMS = Object.values(DEVICE_PLATFORMS);
const DEVICE_FIELDS = 'token platform created_at updated_at';

/** Returns the trimmed token or throws 400 when it is missing, not a string or too long. */
function readToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) throw new HttpError(400, 'token is required');
  if (token.length > MAX_DEVICE_TOKEN_LENGTH) {
    throw new HttpError(400, `token must be at most ${MAX_DEVICE_TOKEN_LENGTH} characters`);
  }
  return token;
}

/**
 * POST /api/devices body { token, platform } -> { device }
 * Idempotent upsert by token: the same phone registering again only refreshes it, and a
 * token already stored for another account moves to the signed-in user.
 */
async function registerDevice(req, res) {
  const token = readToken(req.body?.token);
  const { platform } = req.body ?? {};
  if (!PLATFORMS.includes(platform)) {
    throw new HttpError(400, `platform must be one of: ${PLATFORMS.join(', ')}`);
  }

  const device = await Device.findOneAndUpdate(
    { token },
    { $set: { user_id: req.user._id, platform } },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
      projection: DEVICE_FIELDS,
    }
  ).lean();
  res.json({ device });
}

/**
 * DELETE /api/devices/:token -> 204
 * Removes the token only if it belongs to the signed-in user. Always 204, so a client
 * cannot learn whether another account uses a token.
 */
async function unregisterDevice(req, res) {
  const token = readToken(req.params.token);
  await Device.deleteOne({ token, user_id: req.user._id });
  res.status(204).end();
}

module.exports = { registerDevice, unregisterDevice };
