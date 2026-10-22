const mongoose = require('mongoose');
const { RESERVATION_STATUSES, MAX_RESERVATION_QUANTITY } = require('../utils/reservationRules');

// A reader sets aside copies of one offer to pick them up in the store.
// While pending or confirmed the copies are taken out of the offer's stock.
const reservationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'user_id is required'],
    },
    offer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer',
      required: [true, 'offer_id is required'],
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'store_id is required'],
    },
    book_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'book_id is required'],
    },
    // Unit price when the reservation was made, so later price changes do not alter it.
    price: { type: Number, min: 0 },
    quantity: {
      type: Number,
      required: [true, 'quantity is required'],
      min: [1, 'quantity must be at least 1'],
      max: [MAX_RESERVATION_QUANTITY, `quantity must be at most ${MAX_RESERVATION_QUANTITY}`],
      validate: { validator: Number.isInteger, message: 'quantity must be an integer' },
    },
    status: {
      type: String,
      enum: Object.values(RESERVATION_STATUSES),
      default: RESERVATION_STATUSES.PENDING,
    },
    expires_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false }
);

reservationSchema.index({ user_id: 1, created_at: -1 });
reservationSchema.index({ store_id: 1, status: 1, created_at: -1 });
// Supports the expiry sweep: active reservations past their deadline.
reservationSchema.index({ status: 1, expires_at: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
