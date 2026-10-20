const express = require('express');
const offerController = require('../controllers/offerController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));
router.post('/', offerController.createOffer);
router.put('/:id', validateObjectId(), offerController.updateOffer);
router.delete('/:id', validateObjectId(), offerController.deleteOffer);

module.exports = router;
