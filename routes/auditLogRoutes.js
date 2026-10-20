const express = require('express');
const auditLogController = require('../controllers/auditLogController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.get('/', requireAuth, requireRole(ROLES.ADMIN), auditLogController.listAuditLogs);

module.exports = router;
