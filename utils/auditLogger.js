const AuditLog = require('../models/AuditLog');

/**
 * Persists an audit_logs entry for a create/update/delete operation.
 * @param {{ _id: unknown }} user authenticated user performing the action
 * @param {'create'|'update'|'delete'} action
 * @param {'book'|'store'|'offer'} entity
 * @param {unknown} entityId
 */
async function logAudit(user, action, entity, entityId) {
  return AuditLog.create({ user_id: user._id, action, entity, entity_id: entityId });
}

module.exports = { logAudit };
