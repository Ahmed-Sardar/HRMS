const mongoose = require('mongoose');
const { WFH_STATUS, WFH_WORK_MODE } = require('../config/constants');

const wfhHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['APPLIED', 'MANAGER_APPROVED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMMENTED'],
      required: true,
    },
    level: { type: String, enum: ['MANAGER', 'HR', 'EMPLOYEE'], default: 'EMPLOYEE' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: String,
    at: { type: Date, default: Date.now },
    comment: String,
    previousStatus: String,
    newStatus: String,
  },
  { _id: false },
);

const wfhRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    workMode: {
      type: String,
      enum: Object.values(WFH_WORK_MODE),
      default: WFH_WORK_MODE.WFH,
      index: true,
    },
    dayType: { type: String, enum: ['FULL_DAY', 'HALF_DAY'], default: 'FULL_DAY' },
    halfDaySession: { type: String, enum: ['FIRST_HALF', 'SECOND_HALF'], default: null },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, required: true, min: 0.5 },
    workLocation: { type: String, trim: true, maxlength: 200 },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    contactNumber: { type: String, trim: true },
    handoverTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    status: {
      type: String,
      enum: Object.values(WFH_STATUS),
      default: WFH_STATUS.PENDING,
      index: true,
    },
    approvals: {
      type: [
        new mongoose.Schema(
          {
            level: { type: String, enum: ['MANAGER', 'HR'], required: true },
            decision: { type: String, enum: ['APPROVED', 'REJECTED'], required: true },
            by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            at: { type: Date, default: Date.now },
            comment: String,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewComment: { type: String, trim: true, maxlength: 1000 },
    approvalLevel: { type: String, enum: ['PENDING_MANAGER', 'PENDING_HR', 'COMPLETE'], default: 'PENDING_MANAGER' },
    history: { type: [wfhHistorySchema], default: [] },
  },
  { timestamps: true },
);

wfhRequestSchema.index({ employee: 1, startDate: 1, endDate: 1 });
wfhRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('WfhRequest', wfhRequestSchema);
