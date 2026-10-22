const express = require('express');
const favoriteController = require('../controllers/favoriteController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const { ROLES } = require('../config/constants');

const router = express.Router();

// Store owners are not readers: they have no favorites.
router.use(requireAuth, requireRole(ROLES.READER, ROLES.ADMIN));
router.get('/', favoriteController.listFavorites);
router.put('/:bookId', validateObjectId('bookId'), favoriteController.addFavorite);
router.delete('/:bookId', validateObjectId('bookId'), favoriteController.removeFavorite);

module.exports = router;
