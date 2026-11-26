const mongoose = require('mongoose');
const { REPORT_STATUS, REPORT_PERIOD_TYPES } = require('../config/constants');

const goalSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    weight: { type: Number, default: 0, min: 0, max: 100 },
    target: { type: String, trim: true },
    achievement: { type: String, trim: true },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    status: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'AT_RISK'], default: 'IN_PROGRESS' },
  },
  { _id: true },
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    completionDate: Date,
    status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED'], default: 'COMPLETED' },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  },
  { _id: true },
);

const kpiSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    target: { type: String, trim: true },
    achieved: { type: String, trim: true },
    unit: { type: String, trim: true },
    score: { type: Number, min: 0, max: 100, default: 0 },
  },
  { _id: true },
);

const attachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    path: { type: String, required: true },
    mimetype: String,
    size: Number,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const performanceReportSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    title: { type: String, required: [true, 'Report title is required'], trim: true, maxlength: 200 },
    periodType: { type: String, enum: REPORT_PERIOD_TYPES, required: true, default: 'MONTHLY' },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    selfAssessment: { type: String, trim: true, maxlength: 8000 },
    goals: { type: [goalSchema], default: [] },
    tasksCompleted: { type: [taskSchema], default: [] },
    kpis: { type: [kpiSchema], default: [] },
    achievements: { type: String, trim: true, maxlength: 4000 },
    projectContributions: { type: String, trim: true, maxlength: 4000 },
    challenges: { type: String, trim: true, maxlength: 4000 },
    skillsDevelopment: { type: String, trim: true, maxlength: 4000 },
    employeeComments: { type: String, trim: true, maxlength: 4000 },
    overallRating: { type: Number, min: 0, max: 5, default: 0 },
    managerFeedback: { type: String, trim: true, maxlength: 4000 },
    managerRatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    managerRatedAt: Date,
    financeComments: { type: String, trim: true, maxlength: 4000 },
    hrComments: { type: String, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: Object.values(REPORT_STATUS),
      default: REPORT_STATUS.DRAFT,
      index: true,
    },
    attachments: { type: [attachmentSchema], default: [] },
    submittedAt: Date,
    financeReviewedAt: Date,
    financeReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    forwardedToHrAt: Date,
    hrReviewedAt: Date,
    hrReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    completedAt: Date,
    correctionCount: { type: Number, default: 0 },
    generatedFiles: {
      excel: String,
      csv: String,
      pdf: String,
    },
  },
  { timestamps: true },
);

performanceReportSchema.index({ employee: 1, status: 1 });
performanceReportSchema.index({ periodStart: -1, periodEnd: -1 });
performanceReportSchema.index({ status: 1, createdAt: -1 });

performanceReportSchema.virtual('totalGoalWeight').get(function totalGoalWeight() {
  return (this.goals || []).reduce((sum, goal) => sum + (goal.weight || 0), 0);
});

module.exports = mongoose.model('PerformanceReport', performanceReportSchema);
