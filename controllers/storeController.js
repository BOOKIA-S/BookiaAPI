// Business logic for stores: public listing/detail and admin CRUD.
const Store = require('../models/Store');
const Offer = require('../models/Offer');
const User = require('../models/User');
const { HttpError } = require('../utils/httpError');
const { logAudit } = require('../utils/auditLogger');
const { pickFields, toNumber } = require('../utils/sanitize');
const { distanceKm, isLatitude, isLongitude } = require('../utils/geo');
const { withAvailability } = require('../utils/offerView');
const { AUDIT_ACTIONS, AUDIT_ENTITIES, ROLES } = require('../config/constants');

const STORE_FIELDS = ['name', 'address', 'phone', 'schedule', 'maps_url', 'lat', 'lng'];
const DEFAULT_RADIUS_KM = 5;
const MAX_RADIUS_KM = 50;
const UPDATE_OPTIONS = { returnDocument: 'after', runValidators: true };

/** GET /api/stores */
async function listStores(req, res) {
  const stores = await Store.find().sort({ name: 1 }).lean();
  res.json(stores);
}

/** Reads `radius_km` (default 5, max 50); 400 when it is not a positive number. */
function readRadiusKm(value) {
  if (value === undefined) return DEFAULT_RADIUS_KM;
  const radius = toNumber(value);
  if (radius === undefined || radius <= 0) throw new HttpError(400, 'Invalid radius_km');
  return Math.min(radius, MAX_RADIUS_KM);
}

/**
 * GET /api/stores/near?lat=&lng=&radius_km= : stores with coordinates within the radius,
 * nearest first, each with `distance_km` (2 decimals).
 */
async function listNearStores(req, res) {
  const origin = { lat: toNumber(req.query.lat), lng: toNumber(req.query.lng) };
  if (!isLatitude(origin.lat) || !isLongitude(origin.lng)) {
    throw new HttpError(400, 'lat and lng are required and must be valid coordinates');
  }
  const radiusKm = readRadiusKm(req.query.radius_km);

  const stores = await Store.find({ lat: { $ne: null }, lng: { $ne: null } }).lean();
  const nearby = stores
    .map((store) => ({ ...store, distance_km: distanceKm(origin, store) }))
    .filter((store) => store.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km)
    .map((store) => ({ ...store, distance_km: Math.round(store.distance_km * 100) / 100 }));
  res.json(nearby);
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

/** DELETE /api/stores/:id (cascades to the store's offers; 409 while owners are assigned) */
async function deleteStore(req, res) {
  if (await User.exists({ role: ROLES.STORE_OWNER, store_id: req.params.id })) {
    throw new HttpError(409, 'Reassign or delete the store owner accounts of this store first');
  }
  const store = await Store.findByIdAndDelete(req.params.id);
  if (!store) throw new HttpError(404, 'Store not found');
  await Offer.deleteMany({ store_id: store._id });
  await logAudit(req.user, AUDIT_ACTIONS.DELETE, AUDIT_ENTITIES.STORE, store._id);
  res.status(204).end();
}

module.exports = { listStores, listNearStores, getStore, createStore, updateStore, deleteStore };
