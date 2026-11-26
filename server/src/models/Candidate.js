const mongoose = require('mongoose');
const { RECRUITMENT_STAGE } = require('../config/constants');

const stageHistorySchema = new mongoose.Schema(
  {
    stage: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comment: String,
  },
  { _id: false },
);

const candidateSchema = new mongoose.Schema(
  {
    jobOpening: { type: mongoose.Schema.Types.ObjectId, ref: 'JobOpening', required: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    currentCompany: { type: String, trim: true },
    currentDesignation: { type: String, trim: true },
    totalExperience: { type: Number, default: 0, min: 0 },
    currentCtc: { type: Number, default: 0, min: 0 },
    expectedCtc: { type: Number, default: 0, min: 0 },
    noticePeriodDays: { type: Number, default: 0, min: 0 },
    location: { type: String, trim: true },
    skills: { type: [String], default: [] },
    source: {
      type: String,
      enum: ['LINKEDIN', 'REFERRAL', 'NAUKRI', 'WEBSITE', 'AGENCY', 'CAMPUS', 'OTHER'],
      default: 'OTHER',
    },
    resume: {
      originalName: String,
      fileName: String,
      path: String,
      mimetype: String,
      size: Number,
    },
    portfolioUrl: String,
    linkedinUrl: String,
    stage: {
      type: String,
      enum: Object.values(RECRUITMENT_STAGE),
      default: RECRUITMENT_STAGE.APPLIED,
      index: true,
    },
    stageHistory: { type: [stageHistorySchema], default: [] },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    notes: { type: String, trim: true, maxlength: 4000 },
    rejectionReason: String,
    offeredCtc: { type: Number, default: 0 },
    offerDate: Date,
    joiningDate: Date,
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

candidateSchema.index({ email: 1, jobOpening: 1 }, { unique: true });
candidateSchema.index({ stage: 1, createdAt: -1 });

candidateSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`.trim();
});
candidateSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Candidate', candidateSchema);
