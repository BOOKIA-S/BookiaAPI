const express = require('express');
const reservationController = require('../controllers/reservationController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const { ROLES } = require('../config/constants');
const { STORE_OWNER_ROLE } = require('../utils/reservationRules');

const router = express.Router();
const requireManager = requireRole(ROLES.ADMIN, STORE_OWNER_ROLE);

router.use(requireAuth);
router.post('/', requireRole(ROLES.READER), reservationController.createReservation);
router.get('/mine', reservationController.listMyReservations);
router.patch('/:id/cancel', validateObjectId(), reservationController.cancelMyReservation);
router.get('/manage', requireManager, reservationController.listManagedReservations);
router.patch(
  '/:id/status',
  requireManager,
  validateObjectId(),
  reservationController.updateReservationStatus
);

module.exports = router;
