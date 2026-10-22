/** Error carrying an HTTP status code, rendered by the central error handler. */
class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {string} [code] machine-readable reason the client can branch on
   */
  constructor(status, message, code) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (code) this.code = code;
  }
}

module.exports = { HttpError };
