const mongoose = require('mongoose');

const reportApprovalHistorySchema = new mongoose.Schema(
  {
    report: { type: mongoose.Schema.Types.ObjectId, ref: 'PerformanceReport', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true },
    actorName: String,
    action: {
      type: String,
      required: true,
      enum: [
        'CREATED',
        'UPDATED',
        'SUBMITTED',
        'FINANCE_REVIEW_STARTED',
        'FINANCE_APPROVED',
        'FINANCE_REJECTED',
        'CORRECTION_REQUESTED',
        'FORWARDED_TO_HR',
        'HR_REVIEW_STARTED',
        'HR_APPROVED',
        'HR_REJECTED',
        'ADDITIONAL_INFO_REQUESTED',
        'FORWARDED_TO_MANAGER',
        'MANAGER_FEEDBACK',
        'COMPLETED',
        'ATTACHMENT_ADDED',
      ],
    },
    comments: { type: String, trim: true, maxlength: 4000 },
    previousStatus: String,
    newStatus: String,
    metadata: { type: mongoose.Schema.Types.Mixed },
    ipAddress: String,
  },
  { timestamps: true },
);

reportApprovalHistorySchema.index({ report: 1, createdAt: -1 });

module.exports = mongoose.model('ReportApprovalHistory', reportApprovalHistorySchema);
