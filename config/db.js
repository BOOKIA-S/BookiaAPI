// Single shared Mongoose connection, opened at startup and closed on shutdown.
const mongoose = require('mongoose');
const { MONGODB_URI } = require('./env');

/**
 * Opens the single Mongoose connection used by the whole process.
 * @returns {Promise<typeof mongoose>}
 */
async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  return mongoose;
}

/** Closes the shared connection if it is open. */
async function disconnectDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connectDb, disconnectDb };
