const mongoose = require('mongoose');
const { AUDIT_ACTIONS, AUDIT_ENTITIES } = require('../config/constants');

const auditLogSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: Object.values(AUDIT_ACTIONS), required: true },
    entity: { type: String, enum: Object.values(AUDIT_ENTITIES), required: true },
    entity_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  {
    collection: 'audit_logs',
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
  }
);

auditLogSchema.index({ created_at: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
