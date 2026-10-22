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
    name: { type: String, trim: true, maxlength: 80 },
    password_hash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.READER },
    // The only store a store owner may manage. Required for that role, absent for the others.
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
      required: [
        function storeIdRequired() {
          return this.role === ROLES.STORE_OWNER;
        },
        'store_id is required for store owners',
      ],
    },
    favorite_book_ids: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
      default: [],
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false }
);

userSchema.index({ store_id: 1 });

module.exports = mongoose.model('User', userSchema);
