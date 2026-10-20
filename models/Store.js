const mongoose = require('mongoose');

const URL_PATTERN = /^https?:\/\/\S+$/i;

const storeSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'name is required'], trim: true, maxlength: 150 },
    address: { type: String, required: [true, 'address is required'], trim: true, maxlength: 300 },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    schedule: { type: String, trim: true, maxlength: 200, default: '' },
    maps_url: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
      validate: {
        validator: (value) => value === '' || URL_PATTERN.test(value),
        message: 'maps_url must be an http(s) URL',
      },
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false }
);

storeSchema.index({ name: 1 });

module.exports = mongoose.model('Store', storeSchema);
