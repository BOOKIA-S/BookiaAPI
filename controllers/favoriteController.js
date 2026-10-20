// Reader favorites: a list of book ids stored on the authenticated user.
const User = require('../models/User');
const Book = require('../models/Book');
const { HttpError } = require('../utils/httpError');
const { MAX_FAVORITES } = require('../config/constants');

const BOOK_SUMMARY_FIELDS = 'title author genre publisher';

async function loadFavoriteIds(userId) {
  const user = await User.findById(userId, 'favorite_book_ids').lean();
  if (!user) throw new HttpError(401, 'Invalid or expired session');
  return user.favorite_book_ids ?? [];
}

/** GET /api/favorites -> { items: [ { _id, title, author, genre, publisher } ] } */
async function listFavorites(req, res) {
  const ids = await loadFavoriteIds(req.user._id);
  const books = ids.length
    ? await Book.find({ _id: { $in: ids } }, BOOK_SUMMARY_FIELDS).lean()
    : [];
  // Keep the order in which the reader saved them, most recent first.
  const byId = new Map(books.map((book) => [String(book._id), book]));
  const items = ids
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .reverse();
  res.json({ items });
}

/** PUT /api/favorites/:bookId -> { book_ids } */
async function addFavorite(req, res) {
  const { bookId } = req.params;
  if (!(await Book.exists({ _id: bookId }))) throw new HttpError(404, 'Book not found');

  const ids = await loadFavoriteIds(req.user._id);
  if (!ids.some((id) => String(id) === bookId) && ids.length >= MAX_FAVORITES) {
    throw new HttpError(400, `You can save up to ${MAX_FAVORITES} favorites`);
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { favorite_book_ids: bookId } },
    { returnDocument: 'after', projection: 'favorite_book_ids' }
  ).lean();
  res.json({ book_ids: (user?.favorite_book_ids ?? []).map(String) });
}

/** DELETE /api/favorites/:bookId -> { book_ids } */
async function removeFavorite(req, res) {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { favorite_book_ids: req.params.bookId } },
    { returnDocument: 'after', projection: 'favorite_book_ids' }
  ).lean();
  res.json({ book_ids: (user?.favorite_book_ids ?? []).map(String) });
}

module.exports = { listFavorites, addFavorite, removeFavorite };
