const mongoose = require('mongoose');
const { ROLES } = require('../config/constants');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [EMAIL_PATTERN, 'email is invalid'],
    },
    password_hash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.ADMIN },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false }
);

module.exports = mongoose.model('User', userSchema);
