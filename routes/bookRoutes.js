const express = require('express');
const bookController = require('../controllers/bookController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const { ROLES } = require('../config/constants');

const router = express.Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];

router.get('/', bookController.listBooks);
router.get('/filters', bookController.getBookFilters);
router.get('/:id', validateObjectId(), bookController.getBook);
router.post('/', adminOnly, bookController.createBook);
router.put('/:id', adminOnly, validateObjectId(), bookController.updateBook);
router.delete('/:id', adminOnly, validateObjectId(), bookController.deleteBook);

module.exports = router;
