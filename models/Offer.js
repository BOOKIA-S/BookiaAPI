const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    book_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'book_id is required'],
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'store_id is required'],
    },
    price: {
      type: Number,
      required: [true, 'price is required'],
      min: [0, 'price must be zero or greater'],
      max: [1000000, 'price is too large'],
    },
    is_available: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false }
);

offerSchema.index({ book_id: 1, store_id: 1 }, { unique: true });
offerSchema.index({ store_id: 1, price: 1 });
offerSchema.index({ price: 1 });

module.exports = mongoose.model('Offer', offerSchema);
