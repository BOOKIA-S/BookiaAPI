const mongoose = require('mongoose');

const ISBN_PATTERN = /^[0-9Xx-]{10,17}$/;

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'title is required'], trim: true, maxlength: 200 },
    author: { type: String, required: [true, 'author is required'], trim: true, maxlength: 150 },
    genre: { type: String, trim: true, maxlength: 80, default: '' },
    publisher: { type: String, trim: true, maxlength: 120, default: '' },
    edition: { type: String, trim: true, maxlength: 80, default: '' },
    isbn: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: (value) => value === '' || ISBN_PATTERN.test(value),
        message: 'isbn must contain 10 to 17 digits, dashes or X',
      },
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false }
);

bookSchema.index(
  { title: 'text', author: 'text' },
  { name: 'book_text_search', default_language: 'spanish', weights: { title: 3, author: 1 } }
);
bookSchema.index({ title: 1 });
bookSchema.index({ author: 1 });
bookSchema.index({ genre: 1 });
bookSchema.index({ publisher: 1 });
bookSchema.index({ isbn: 1 });

module.exports = mongoose.model('Book', bookSchema);
