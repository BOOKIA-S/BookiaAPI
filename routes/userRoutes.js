const express = require('express');
const userController = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));
router.get('/', userController.listStoreOwners);
router.post('/', userController.createStoreOwner);
router.patch('/:id', validateObjectId(), userController.updateStoreOwner);
router.delete('/:id', validateObjectId(), userController.deleteStoreOwner);

module.exports = router;
