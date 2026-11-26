const mongoose = require('mongoose');

/**
 * Bookkeeping for background jobs so a job runs once per interval even when the
 * process restarts, and so administrators can see what the scheduler last did.
 */
const automationRunSchema = new mongoose.Schema(
  {
    job: { type: String, required: true, unique: true, index: true },
    lastRunAt: Date,
    lastStatus: { type: String, enum: ['SUCCESS', 'FAILED', 'SKIPPED'], default: 'SUCCESS' },
    lastSummary: { type: mongoose.Schema.Types.Mixed },
    lastError: { type: String, trim: true },
    runCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('AutomationRun', automationRunSchema);
