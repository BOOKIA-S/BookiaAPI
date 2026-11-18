const express = require('express');
const deviceController = require('../controllers/deviceController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Any signed-in role may receive push notifications (readers and store desks).
router.use(requireAuth);
router.post('/', deviceController.registerDevice);
router.delete('/:token', deviceController.unregisterDevice);

module.exports = router;
