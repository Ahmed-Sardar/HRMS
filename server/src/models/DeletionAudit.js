const mongoose = require('mongoose');

/**
 * Permanent record of an employee erasure. Deliberately stores no deleted
 * personal data: the employee is identified only by the business employee ID
 * and a non-identifying deletion reference. The tombstone Employee document
 * keeps the retained relationships (payroll, payslips, approvals, audit logs).
 */
const deletionAuditSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true },
    employeeId: { type: String, required: true, trim: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deletedByName: { type: String, trim: true },
    deletedByRole: { type: String, trim: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    deletedAt: { type: Date, default: Date.now, index: true },
    recordsDeleted: { type: mongoose.Schema.Types.Mixed, default: {} },
    recordsRetained: { type: mongoose.Schema.Types.Mixed, default: {} },
    recordsAnonymized: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true },
);

deletionAuditSchema.index({ deletedAt: -1 });

module.exports = mongoose.model('DeletionAudit', deletionAuditSchema);
