const mongoose = require('mongoose');
const { DEVICE_PLATFORMS, MAX_DEVICE_TOKEN_LENGTH } = require('../config/constants');

// A phone of a signed-in user that can receive push notifications (FCM registration token).
// A token belongs to one user at a time: when another account signs in on the same phone
// the token is reassigned to it.
const deviceSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'user_id is required'],
    },
    token: {
      type: String,
      required: [true, 'token is required'],
      unique: true,
      trim: true,
      maxlength: MAX_DEVICE_TOKEN_LENGTH,
    },
    platform: {
      type: String,
      required: [true, 'platform is required'],
      enum: Object.values(DEVICE_PLATFORMS),
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false }
);

deviceSchema.index({ user_id: 1 });

module.exports = mongoose.model('Device', deviceSchema);
