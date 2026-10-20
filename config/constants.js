// Application-wide constants shared by models, middlewares and controllers.
const ROLES = Object.freeze({ ADMIN: 'admin' });

const AUDIT_ACTIONS = Object.freeze({ CREATE: 'create', UPDATE: 'update', DELETE: 'delete' });

const AUDIT_ENTITIES = Object.freeze({ BOOK: 'book', STORE: 'store', OFFER: 'offer' });

const AUTH_COOKIE_NAME = 'token';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
const DEFAULT_AUDIT_LIMIT = 50;
const MAX_AUDIT_LIMIT = 200;

module.exports = {
  ROLES,
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  AUTH_COOKIE_NAME,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  DEFAULT_AUDIT_LIMIT,
  MAX_AUDIT_LIMIT,
};
