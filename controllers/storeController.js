// Business logic for stores: public listing/detail and admin CRUD.
const Store = require('../models/Store');
const Offer = require('../models/Offer');
const { HttpError } = require('../utils/httpError');
const { logAudit } = require('../utils/auditLogger');
const { pickFields } = require('../utils/sanitize');
const { withAvailability } = require('../utils/offerView');
const { AUDIT_ACTIONS, AUDIT_ENTITIES } = require('../config/constants');

const STORE_FIELDS = ['name', 'address', 'phone', 'schedule', 'maps_url'];
const UPDATE_OPTIONS = { returnDocument: 'after', runValidators: true };

/** GET /api/stores */
async function listStores(req, res) {
  const stores = await Store.find().sort({ name: 1 }).lean();
  res.json(stores);
}

/** GET /api/stores/:id */
async function getStore(req, res) {
  const store = await Store.findById(req.params.id).lean();
  if (!store) throw new HttpError(404, 'Store not found');
  const offers = await Offer.find({ store_id: store._id })
    .populate('book_id', 'title author')
    .lean();
  const storeOffers = offers
    .map((offer) => {
      const { _id, price, stock, is_available } = withAvailability(offer);
      return { _id, price, stock, is_available, book: offer.book_id };
    })
    .sort((a, b) => (a.book?.title || '').localeCompare(b.book?.title || '', 'es'));
  res.json({ ...store, offers: storeOffers });
}

/** POST /api/stores */
async function createStore(req, res) {
  const store = await Store.create(pickFields(req.body, STORE_FIELDS));
  await logAudit(req.user, AUDIT_ACTIONS.CREATE, AUDIT_ENTITIES.STORE, store._id);
  res.status(201).json(store);
}

/** PUT /api/stores/:id */
async function updateStore(req, res) {
  const store = await Store.findByIdAndUpdate(
    req.params.id,
    pickFields(req.body, STORE_FIELDS),
    UPDATE_OPTIONS
  );
  if (!store) throw new HttpError(404, 'Store not found');
  await logAudit(req.user, AUDIT_ACTIONS.UPDATE, AUDIT_ENTITIES.STORE, store._id);
  res.json(store);
}

/** DELETE /api/stores/:id (cascades to the store's offers) */
async function deleteStore(req, res) {
  const store = await Store.findByIdAndDelete(req.params.id);
  if (!store) throw new HttpError(404, 'Store not found');
  await Offer.deleteMany({ store_id: store._id });
  await logAudit(req.user, AUDIT_ACTIONS.DELETE, AUDIT_ENTITIES.STORE, store._id);
  res.status(204).end();
}

module.exports = { listStores, getStore, createStore, updateStore, deleteStore };
