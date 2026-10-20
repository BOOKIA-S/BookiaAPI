// Read-only access to the audit trail for administrators.
const AuditLog = require('../models/AuditLog');
const { toPositiveInt } = require('../utils/sanitize');
const { DEFAULT_AUDIT_LIMIT, MAX_AUDIT_LIMIT } = require('../config/constants');

/** GET /api/audit-logs?limit=50 */
async function listAuditLogs(req, res) {
  const limit = toPositiveInt(req.query.limit, DEFAULT_AUDIT_LIMIT, MAX_AUDIT_LIMIT);
  const logs = await AuditLog.find().sort({ created_at: -1 }).limit(limit).lean();
  res.json(logs);
}

module.exports = { listAuditLogs };
