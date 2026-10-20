// Request-level input validation and sanitization middlewares.
const { HttpError } = require('../utils/httpError');
const { isValidObjectId, stripOperators } = require('../utils/sanitize');

/** Removes Mongo operator keys ($...) and dotted keys from the JSON body. */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = stripOperators(req.body);
  }
  next();
}

/** Rejects requests whose route param is not a valid ObjectId. */
function validateObjectId(paramName = 'id') {
  return function checkObjectId(req, res, next) {
    if (!isValidObjectId(req.params[paramName])) {
      return next(new HttpError(400, `Invalid ${paramName}`));
    }
    return next();
  };
}

module.exports = { sanitizeBody, validateObjectId };
