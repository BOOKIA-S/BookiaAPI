const express = require('express');
const storeController = require('../controllers/storeController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { require_store_access } = require('../middlewares/storeAccess');
const { validateObjectId } = require('../middlewares/validation');
const { ROLES } = require('../config/constants');

const router = express.Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];
// A store owner may edit the data of its own store only.
const storeManagers = [
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.STORE_OWNER),
  validateObjectId(),
  require_store_access((req) => req.params.id),
];

router.get('/', storeController.listStores);
router.get('/:id', validateObjectId(), storeController.getStore);
router.post('/', adminOnly, storeController.createStore);
router.put('/:id', storeManagers, storeController.updateStore);
router.delete('/:id', adminOnly, validateObjectId(), storeController.deleteStore);

module.exports = router;
