const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorName: String,
    actorRole: String,
    action: { type: String, required: true, index: true },
    module: {
      type: String,
      required: true,
      enum: [
        'AUTH',
        'USER',
        'EMPLOYEE',
        'DEPARTMENT',
        'DESIGNATION',
        'ATTENDANCE',
        'LEAVE',
        'PERFORMANCE',
        'FINANCE',
        'HR',
        'PAYROLL',
        'REIMBURSEMENT',
        'RECRUITMENT',
        'DOCUMENT',
        'ASSET',
        'NOTIFICATION',
        'ANNOUNCEMENT',
        'SETTINGS',
        'SHIFT',
        'HOLIDAY',
        'SYSTEM',
      ],
      index: true,
    },
    entityType: String,
    entityId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String, required: true },
    previousValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    ipAddress: String,
    userAgent: String,
    method: String,
    path: String,
    statusCode: Number,
  },
  { timestamps: true },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ module: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
