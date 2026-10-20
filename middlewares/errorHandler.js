// 404 fallback and central error handler. Always responds with { message }.
const { IS_TEST } = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ message: 'Route not found' });
}

/** Maps known error types to HTTP statuses; hides internals for unexpected errors. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.name === 'HttpError') {
    return res.status(err.status).json({ message: err.message });
  }
  if (err.name === 'ValidationError' && err.errors) {
    const message = Object.values(err.errors)
      .map((detail) => detail.message)
      .join(', ');
    return res.status(400).json({ message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid value for ${err.path}` });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'A record with the same unique fields already exists' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body too large' });
  }
  if (!IS_TEST) console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
}

module.exports = { notFound, errorHandler };
