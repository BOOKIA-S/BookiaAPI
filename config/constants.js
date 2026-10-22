// Application-wide constants shared by models, middlewares and controllers.
const ROLES = Object.freeze({ ADMIN: 'admin', READER: 'reader', STORE_OWNER: 'store_owner' });

const AUDIT_ACTIONS = Object.freeze({ CREATE: 'create', UPDATE: 'update', DELETE: 'delete' });

const AUDIT_ENTITIES = Object.freeze({
  BOOK: 'book',
  STORE: 'store',
  OFFER: 'offer',
  USER: 'user',
});

const AUTH_COOKIE_NAME = 'token';

// Returned with 403 while a user still has to replace the initial password set by an admin.
const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;
const MAX_FAVORITES = 200;

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
const DEFAULT_AUDIT_LIMIT = 50;
const MAX_AUDIT_LIMIT = 200;

module.exports = {
  ROLES,
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  AUTH_COOKIE_NAME,
  PASSWORD_CHANGE_REQUIRED,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_FAVORITES,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  DEFAULT_AUDIT_LIMIT,
  MAX_AUDIT_LIMIT,
};
