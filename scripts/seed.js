// Seeds the database: upserts the admin user and replaces books, stores and offers
// with sample data. Usage: `npm run seed` (requires MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD).
const bcrypt = require('bcrypt');
const { connectDb, disconnectDb } = require('../config/db');
const { BCRYPT_SALT_ROUNDS, assertRequiredEnv } = require('../config/env');
const { ROLES } = require('../config/constants');
const Book = require('../models/Book');
const Store = require('../models/Store');
const Offer = require('../models/Offer');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { STORES, BOOKS, OFFERS } = require('./seedData');

const MIN_ADMIN_PASSWORD_LENGTH = 8;

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must have at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`);
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  await User.findOneAndUpdate(
    { email },
    { email, password_hash: passwordHash, role: ROLES.ADMIN },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  console.log(`Admin user ready: ${email}`);
}

async function seedCatalog() {
  await Promise.all([Offer.deleteMany({}), Book.deleteMany({}), Store.deleteMany({})]);

  const storeDocs = await Store.insertMany(STORES.map(({ key: _key, ...store }) => store));
  const bookDocs = await Book.insertMany(BOOKS.map(({ key: _key, ...book }) => book));
  const storeIdByKey = new Map(STORES.map((store, index) => [store.key, storeDocs[index]._id]));
  const bookIdByKey = new Map(BOOKS.map((book, index) => [book.key, bookDocs[index]._id]));

  const offers = OFFERS.map(([bookKey, storeKey, price, stock]) => ({
    book_id: bookIdByKey.get(bookKey),
    store_id: storeIdByKey.get(storeKey),
    price,
    stock,
  }));
  await Offer.insertMany(offers);

  console.log(
    `Seeded ${storeDocs.length} stores, ${bookDocs.length} books, ${offers.length} offers`
  );
}

async function main() {
  assertRequiredEnv(['MONGODB_URI', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']);
  await connectDb();
  await Promise.all([Book, Store, Offer, User, AuditLog].map((model) => model.syncIndexes()));
  await seedAdmin();
  await seedCatalog();
}

main()
  .then(() => disconnectDb())
  .catch(async (error) => {
    console.error('Seed failed:', error.message);
    await disconnectDb();
    process.exitCode = 1;
  });
