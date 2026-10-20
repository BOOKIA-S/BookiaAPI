// Business logic for offers (price and availability of a book in a store). Admin only.
const Offer = require('../models/Offer');
const Book = require('../models/Book');
const Store = require('../models/Store');
const { HttpError } = require('../utils/httpError');
const { logAudit } = require('../utils/auditLogger');
const { isValidObjectId, pickFields } = require('../utils/sanitize');
const { AUDIT_ACTIONS, AUDIT_ENTITIES } = require('../config/constants');

const OFFER_FIELDS = ['book_id', 'store_id', 'price', 'is_available'];
const UPDATE_OPTIONS = { returnDocument: 'after', runValidators: true };

/** Ensures referenced book/store ids are well formed and exist. */
async function assertReferencesExist(data) {
  if (data.book_id !== undefined) {
    if (!isValidObjectId(data.book_id)) throw new HttpError(400, 'Invalid book_id');
    if (!(await Book.exists({ _id: data.book_id })))
      throw new HttpError(400, 'Book does not exist');
  }
  if (data.store_id !== undefined) {
    if (!isValidObjectId(data.store_id)) throw new HttpError(400, 'Invalid store_id');
    if (!(await Store.exists({ _id: data.store_id }))) {
      throw new HttpError(400, 'Store does not exist');
    }
  }
}

/** POST /api/offers */
async function createOffer(req, res) {
  const data = pickFields(req.body, OFFER_FIELDS);
  await assertReferencesExist(data);
  const offer = await Offer.create(data);
  await logAudit(req.user, AUDIT_ACTIONS.CREATE, AUDIT_ENTITIES.OFFER, offer._id);
  res.status(201).json(offer);
}

/** PUT /api/offers/:id */
async function updateOffer(req, res) {
  const data = pickFields(req.body, OFFER_FIELDS);
  await assertReferencesExist(data);
  const offer = await Offer.findByIdAndUpdate(req.params.id, data, UPDATE_OPTIONS);
  if (!offer) throw new HttpError(404, 'Offer not found');
  await logAudit(req.user, AUDIT_ACTIONS.UPDATE, AUDIT_ENTITIES.OFFER, offer._id);
  res.json(offer);
}

/** DELETE /api/offers/:id */
async function deleteOffer(req, res) {
  const offer = await Offer.findByIdAndDelete(req.params.id);
  if (!offer) throw new HttpError(404, 'Offer not found');
  await logAudit(req.user, AUDIT_ACTIONS.DELETE, AUDIT_ENTITIES.OFFER, offer._id);
  res.status(204).end();
}

module.exports = { createOffer, updateOffer, deleteOffer };
