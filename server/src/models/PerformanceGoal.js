const mongoose = require('mongoose');

const performanceGoalSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, maxlength: 2000 },
    category: {
      type: String,
      enum: ['BUSINESS', 'TECHNICAL', 'BEHAVIOURAL', 'LEARNING', 'DELIVERY'],
      default: 'BUSINESS',
    },
    weight: { type: Number, default: 0, min: 0, max: 100 },
    targetDate: Date,
    periodStart: Date,
    periodEnd: Date,
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'PARTIALLY_ACHIEVED', 'MISSED'],
      default: 'NOT_STARTED',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    managerComment: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

performanceGoalSchema.index({ employee: 1, status: 1 });

module.exports = mongoose.model('PerformanceGoal', performanceGoalSchema);
