const mongoose = require('mongoose');
const { LEAVE_STATUS } = require('../config/constants');

const leaveHistorySchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['APPLIED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMMENTED'], required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: String,
    at: { type: Date, default: Date.now },
    comment: String,
    previousStatus: String,
    newStatus: String,
  },
  { _id: false },
);

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    leaveType: { type: String, required: true, trim: true, uppercase: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isHalfDay: { type: Boolean, default: false },
    halfDaySession: { type: String, enum: ['FIRST_HALF', 'SECOND_HALF'], default: null },
    totalDays: { type: Number, required: true, min: 0.5 },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    contactDuringLeave: { type: String, trim: true },
    handoverTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    status: {
      type: String,
      enum: Object.values(LEAVE_STATUS),
      default: LEAVE_STATUS.PENDING,
      index: true,
    },
    appliedAt: { type: Date, default: Date.now },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewComment: { type: String, trim: true, maxlength: 1000 },
    history: { type: [leaveHistorySchema], default: [] },
  },
  { timestamps: true },
);

leaveRequestSchema.index({ employee: 1, startDate: 1, endDate: 1 });
leaveRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
