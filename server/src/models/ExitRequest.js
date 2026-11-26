const mongoose = require('mongoose');
const { EXIT_STATUS, EXIT_TYPE, CLEARANCE_DEPARTMENT } = require('../config/constants');

const decisionSchema = new mongoose.Schema(
  {
    decision: { type: String, enum: ['APPROVED', 'REJECTED'], required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    comment: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const clearanceSchema = new mongoose.Schema(
  {
    department: { type: String, enum: Object.values(CLEARANCE_DEPARTMENT), required: true },
    status: { type: String, enum: ['PENDING', 'CLEARED', 'NOT_REQUIRED'], default: 'PENDING' },
    remarks: { type: String, trim: true, maxlength: 1000 },
    clearedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clearedAt: Date,
  },
  { _id: true },
);

const assetCheckSchema = new mongoose.Schema(
  {
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyAsset' },
    assetTag: String,
    name: String,
    returned: { type: Boolean, default: false },
    returnedAt: Date,
    condition: String,
    remarks: String,
  },
  { _id: true },
);

const exitHistorySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    comment: String,
    previousStatus: String,
    newStatus: String,
  },
  { _id: false },
);

const exitRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    exitType: {
      type: String,
      enum: Object.values(EXIT_TYPE),
      default: EXIT_TYPE.RESIGNATION,
      index: true,
    },
    resignationDate: { type: Date, required: true },
    requestedLastWorkingDay: { type: Date, required: true },
    approvedLastWorkingDay: Date,
    noticePeriodDays: { type: Number, default: 30, min: 0 },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    managerReview: decisionSchema,
    hrReview: decisionSchema,
    status: {
      type: String,
      enum: Object.values(EXIT_STATUS),
      default: EXIT_STATUS.PENDING_MANAGER,
      index: true,
    },
    clearances: { type: [clearanceSchema], default: [] },
    exitInterview: {
      scheduledAt: Date,
      done: { type: Boolean, default: false },
      interviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      feedback: { type: String, trim: true, maxlength: 3000 },
      rating: { type: Number, min: 1, max: 5 },
      wouldRecommend: { type: Boolean },
    },
    assets: { type: [assetCheckSchema], default: [] },
    settlement: {
      leaveEncashmentDays: { type: Number, default: 0 },
      leaveEncashmentAmount: { type: Number, default: 0 },
      pendingSalary: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
      otherDeductions: { type: Number, default: 0 },
      noticeRecovery: { type: Number, default: 0 },
      netSettlement: { type: Number, default: 0 },
      notes: { type: String, trim: true },
      status: { type: String, enum: ['PENDING', 'APPROVED', 'SETTLED'], default: 'PENDING' },
      computedAt: Date,
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approvedAt: Date,
      settledAt: Date,
      paidReference: String,
    },
    letters: {
      relievingIssuedAt: Date,
      experienceIssuedAt: Date,
      issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    completedAt: Date,
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    history: { type: [exitHistorySchema], default: [] },
  },
  { timestamps: true },
);

exitRequestSchema.index({ status: 1, createdAt: -1 });
exitRequestSchema.index({ employee: 1, status: 1 });

module.exports = mongoose.model('ExitRequest', exitRequestSchema);
