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
    // Copies on hand. `is_available` is derived from it (stock > 0) and never stored.
    stock: {
      type: Number,
      required: [true, 'stock is required'],
      default: 0,
      min: [0, 'stock must be zero or greater'],
      max: [100000, 'stock is too large'],
      validate: { validator: Number.isInteger, message: 'stock must be an integer' },
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false }
);

offerSchema.index({ book_id: 1, store_id: 1 }, { unique: true });
offerSchema.index({ store_id: 1, price: 1 });
offerSchema.index({ price: 1 });
// Supports "in stock" lookups per book (e.g. stock > 0 with the cheapest price first).
offerSchema.index({ book_id: 1, stock: 1, price: 1 });

module.exports = mongoose.model('Offer', offerSchema);
