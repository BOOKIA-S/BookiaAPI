// Mounts every resource router under /api.
const express = require('express');
const authRoutes = require('./authRoutes');
const bookRoutes = require('./bookRoutes');
const storeRoutes = require('./storeRoutes');
const offerRoutes = require('./offerRoutes');
const auditLogRoutes = require('./auditLogRoutes');
const favoriteRoutes = require('./favoriteRoutes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/books', bookRoutes);
router.use('/stores', storeRoutes);
router.use('/offers', offerRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/favorites', favoriteRoutes);

module.exports = router;
