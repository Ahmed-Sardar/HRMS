const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema(
  {
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
    jobOpening: { type: mongoose.Schema.Types.ObjectId, ref: 'JobOpening' },
    round: { type: Number, default: 1, min: 1 },
    type: {
      type: String,
      enum: ['SCREENING', 'TECHNICAL', 'MANAGERIAL', 'HR', 'FINAL'],
      default: 'TECHNICAL',
    },
    mode: { type: String, enum: ['IN_PERSON', 'VIDEO', 'PHONE'], default: 'VIDEO' },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 60 },
    location: String,
    meetingLink: String,
    interviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    status: {
      type: String,
      enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'],
      default: 'SCHEDULED',
      index: true,
    },
    feedback: {
      technical: { type: Number, min: 0, max: 5, default: 0 },
      communication: { type: Number, min: 0, max: 5, default: 0 },
      cultureFit: { type: Number, min: 0, max: 5, default: 0 },
      overall: { type: Number, min: 0, max: 5, default: 0 },
      strengths: String,
      weaknesses: String,
      comments: String,
      recommendation: {
        type: String,
        enum: ['STRONG_HIRE', 'HIRE', 'HOLD', 'NO_HIRE', ''],
        default: '',
      },
      submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      submittedAt: Date,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

interviewSchema.index({ scheduledAt: 1, status: 1 });

module.exports = mongoose.model('Interview', interviewSchema);
