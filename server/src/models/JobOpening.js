const mongoose = require('mongoose');

const jobOpeningSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
    designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation' },
    location: { type: String, trim: true },
    employmentType: {
      type: String,
      enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT'],
      default: 'FULL_TIME',
    },
    workMode: { type: String, enum: ['ONSITE', 'HYBRID', 'REMOTE'], default: 'ONSITE' },
    experienceMin: { type: Number, default: 0, min: 0 },
    experienceMax: { type: Number, default: 0, min: 0 },
    salaryMin: { type: Number, default: 0, min: 0 },
    salaryMax: { type: Number, default: 0, min: 0 },
    openings: { type: Number, default: 1, min: 1 },
    description: { type: String, required: true },
    responsibilities: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'CANCELLED'],
      default: 'OPEN',
      index: true,
    },
    hiringManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    postedAt: { type: Date, default: Date.now },
    closingDate: Date,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

jobOpeningSchema.virtual('applicantCount', {
  ref: 'Candidate',
  localField: '_id',
  foreignField: 'jobOpening',
  count: true,
});

jobOpeningSchema.set('toJSON', { virtuals: true });
jobOpeningSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('JobOpening', jobOpeningSchema);
