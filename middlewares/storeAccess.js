// Store-scoped authorization: admins manage every store, a store owner only its own.
const Offer = require('../models/Offer');
const { ROLES } = require('../config/constants');
const { HttpError } = require('../utils/httpError');
const { isValidObjectId } = require('../utils/sanitize');

/**
 * Allows the request when the authenticated user may operate on the store returned
 * by `store_id_getter(req)` (sync or async). Admins always pass; store owners pass only
 * when it is their `req.user.store_id`; every other role gets 403.
 * With `optional: true` a missing store id (undefined/null) is allowed, e.g. a body
 * field that is not being changed.
 * @param {(req: import('express').Request) => unknown} store_id_getter
 * @param {{ optional?: boolean }} [options]
 */
function require_store_access(store_id_getter, { optional = false } = {}) {
  return async function checkStoreAccess(req, res, next) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    if (req.user.role === ROLES.ADMIN) return next();
    if (req.user.role !== ROLES.STORE_OWNER || !req.user.store_id) {
      throw new HttpError(403, 'Forbidden');
    }

    const storeId = await store_id_getter(req);
    if ((storeId === undefined || storeId === null) && optional) return next();
    if (!storeId || String(storeId) !== String(req.user.store_id)) {
      throw new HttpError(403, 'You can only manage your own store');
    }
    return next();
  };
}

/** Getter for routes with an offer id in `:id`: resolves to that offer's store id. */
async function offerStoreId(req) {
  if (!isValidObjectId(req.params.id)) return null;
  const offer = await Offer.findById(req.params.id, 'store_id').lean();
  return offer?.store_id ?? null;
}

module.exports = { require_store_access, offerStoreId };
