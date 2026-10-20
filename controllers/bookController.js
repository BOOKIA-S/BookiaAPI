// Business logic for books: public search/detail and admin CRUD.
const Book = require('../models/Book');
const Offer = require('../models/Offer');
const { HttpError } = require('../utils/httpError');
const { logAudit } = require('../utils/auditLogger');
const {
  escapeRegex,
  isValidObjectId,
  pickFields,
  toCleanString,
  toNumber,
  toPositiveInt,
} = require('../utils/sanitize');
const {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} = require('../config/constants');

const BOOK_FIELDS = ['title', 'author', 'genre', 'publisher', 'edition', 'isbn'];
const MAX_PAGE = 10000;
const UPDATE_OPTIONS = { returnDocument: 'after', runValidators: true };

/** Builds the offer-level filter (store and price range) from query params. */
function buildOfferFilter(query) {
  const filter = {};
  const storeId = toCleanString(query.store_id);
  if (storeId !== undefined) {
    if (!isValidObjectId(storeId)) throw new HttpError(400, 'Invalid store_id');
    filter.store_id = storeId;
  }
  const minPrice = toNumber(query.min_price);
  const maxPrice = toNumber(query.max_price);
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }
  return filter;
}

/** Builds the book-level filter (text search, genre, publisher) from query params. */
function buildBookFilter(query) {
  const filter = {};
  const search = toCleanString(query.q, 100);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: pattern }, { author: pattern }, { isbn: pattern }];
  }
  const genre = toCleanString(query.genre, 80);
  if (genre) filter.genre = genre;
  const publisher = toCleanString(query.publisher, 120);
  if (publisher) filter.publisher = publisher;
  return filter;
}

/** Lowest price among available offers, or null when none is available. */
function computeMinPrice(offers) {
  const prices = offers.filter((offer) => offer.is_available).map((offer) => offer.price);
  return prices.length > 0 ? Math.min(...prices) : null;
}

function toListOffer(offer) {
  const store = offer.store_id ? { _id: offer.store_id._id, name: offer.store_id.name } : null;
  return { _id: offer._id, price: offer.price, is_available: offer.is_available, store };
}

/** GET /api/books */
async function listBooks(req, res) {
  const page = toPositiveInt(req.query.page, 1, MAX_PAGE);
  const limit = toPositiveInt(req.query.limit, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const bookFilter = buildBookFilter(req.query);
  const offerFilter = buildOfferFilter(req.query);

  if (Object.keys(offerFilter).length > 0) {
    const matchingBookIds = await Offer.distinct('book_id', offerFilter);
    bookFilter._id = { $in: matchingBookIds };
  }

  const [total, books] = await Promise.all([
    Book.countDocuments(bookFilter),
    Book.find(bookFilter)
      .sort({ title: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const bookIds = books.map((book) => book._id);
  const offers =
    bookIds.length > 0
      ? await Offer.find({ ...offerFilter, book_id: { $in: bookIds } })
          .populate('store_id', 'name')
          .sort({ price: 1 })
          .lean()
      : [];

  const offersByBook = new Map();
  for (const offer of offers) {
    const key = String(offer.book_id);
    if (!offersByBook.has(key)) offersByBook.set(key, []);
    offersByBook.get(key).push(toListOffer(offer));
  }

  const items = books.map((book) => {
    const bookOffers = offersByBook.get(String(book._id)) || [];
    return { ...book, offers: bookOffers, min_price: computeMinPrice(bookOffers) };
  });

  res.json({ items, total, page, limit });
}

/** GET /api/books/filters */
async function getBookFilters(req, res) {
  const [genres, publishers] = await Promise.all([
    Book.distinct('genre'),
    Book.distinct('publisher'),
  ]);
  const clean = (values) =>
    values
      .filter((value) => typeof value === 'string' && value)
      .sort((a, b) => a.localeCompare(b, 'es'));
  res.json({ genres: clean(genres), publishers: clean(publishers) });
}

/** GET /api/books/:id */
async function getBook(req, res) {
  const book = await Book.findById(req.params.id).lean();
  if (!book) throw new HttpError(404, 'Book not found');
  const offers = await Offer.find({ book_id: book._id })
    .populate('store_id')
    .sort({ price: 1 })
    .lean();
  res.json({
    ...book,
    offers: offers.map((offer) => ({
      _id: offer._id,
      price: offer.price,
      is_available: offer.is_available,
      store: offer.store_id,
    })),
  });
}

/** POST /api/books */
async function createBook(req, res) {
  const book = await Book.create(pickFields(req.body, BOOK_FIELDS));
  await logAudit(req.user, AUDIT_ACTIONS.CREATE, AUDIT_ENTITIES.BOOK, book._id);
  res.status(201).json(book);
}

/** PUT /api/books/:id */
async function updateBook(req, res) {
  const book = await Book.findByIdAndUpdate(
    req.params.id,
    pickFields(req.body, BOOK_FIELDS),
    UPDATE_OPTIONS
  );
  if (!book) throw new HttpError(404, 'Book not found');
  await logAudit(req.user, AUDIT_ACTIONS.UPDATE, AUDIT_ENTITIES.BOOK, book._id);
  res.json(book);
}

/** DELETE /api/books/:id (cascades to the book's offers) */
async function deleteBook(req, res) {
  const book = await Book.findByIdAndDelete(req.params.id);
  if (!book) throw new HttpError(404, 'Book not found');
  await Offer.deleteMany({ book_id: book._id });
  await logAudit(req.user, AUDIT_ACTIONS.DELETE, AUDIT_ENTITIES.BOOK, book._id);
  res.status(204).end();
}

module.exports = { listBooks, getBookFilters, getBook, createBook, updateBook, deleteBook };
