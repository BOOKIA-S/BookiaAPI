const express = require('express');
const favoriteController = require('../controllers/favoriteController');
const { requireAuth } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');

const router = express.Router();

router.use(requireAuth);
router.get('/', favoriteController.listFavorites);
router.put('/:bookId', validateObjectId('bookId'), favoriteController.addFavorite);
router.delete('/:bookId', validateObjectId('bookId'), favoriteController.removeFavorite);

module.exports = router;
