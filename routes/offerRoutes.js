const express = require('express');
const offerController = require('../controllers/offerController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { require_store_access, offerStoreId } = require('../middlewares/storeAccess');
const { validateObjectId } = require('../middlewares/validation');
const { ROLES } = require('../config/constants');

const router = express.Router();
const bodyStoreId = (req) => req.body?.store_id;

// Admins manage every offer; a store owner only the offers of its own store.
router.use(requireAuth, requireRole(ROLES.ADMIN, ROLES.STORE_OWNER));
router.post('/', require_store_access(bodyStoreId), offerController.createOffer);
router.put(
  '/:id',
  validateObjectId(),
  require_store_access(offerStoreId),
  require_store_access(bodyStoreId, { optional: true }),
  offerController.updateOffer
);
router.delete(
  '/:id',
  validateObjectId(),
  require_store_access(offerStoreId),
  offerController.deleteOffer
);

module.exports = router;
