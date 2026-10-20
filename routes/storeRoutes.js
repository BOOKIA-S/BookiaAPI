const express = require('express');
const storeController = require('../controllers/storeController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const { ROLES } = require('../config/constants');

const router = express.Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];

router.get('/', storeController.listStores);
router.get('/:id', validateObjectId(), storeController.getStore);
router.post('/', adminOnly, storeController.createStore);
router.put('/:id', adminOnly, validateObjectId(), storeController.updateStore);
router.delete('/:id', adminOnly, validateObjectId(), storeController.deleteStore);

module.exports = router;
