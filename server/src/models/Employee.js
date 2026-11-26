const mongoose = require('mongoose');
const { EMPLOYMENT_STATUS, EMPLOYMENT_TYPE } = require('../config/constants');

const onboardingTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    owner: { type: String, enum: ['HR', 'EMPLOYEE', 'ADMIN', 'MANAGER'], default: 'HR' },
    dueDate: Date,
    completed: { type: Boolean, default: false },
    completedAt: Date,
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true, timestamps: true },
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    relation: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    postalCode: { type: String, trim: true },
  },
  { _id: false },
);

const bankDetailsSchema = new mongoose.Schema(
  {
    accountName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    ifscCode: { type: String, trim: true, uppercase: true },
    branch: { type: String, trim: true },
    panNumber: { type: String, trim: true, uppercase: true },
    taxId: { type: String, trim: true },
  },
  { _id: false },
);

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    firstName: { type: String, required: [true, 'First name is required'], trim: true, maxlength: 80 },
    lastName: { type: String, required: [true, 'Last name is required'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    personalEmail: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    altPhone: { type: String, trim: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'], default: 'UNDISCLOSED' },
    maritalStatus: { type: String, enum: ['SINGLE', 'MARRIED', 'OTHER'], default: 'SINGLE' },
    profilePhoto: { type: String },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
    designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', index: true },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true },
    dateOfJoining: { type: Date, required: true },
    confirmationDate: Date,
    dateOfExit: Date,
    employmentType: { type: String, enum: Object.values(EMPLOYMENT_TYPE), default: EMPLOYMENT_TYPE.FULL_TIME },
    workLocation: { type: String, trim: true, default: 'Head Office' },
    employmentStatus: {
      type: String,
      enum: Object.values(EMPLOYMENT_STATUS),
      default: EMPLOYMENT_STATUS.ACTIVE,
      index: true,
    },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    address: addressSchema,
    emergencyContact: emergencyContactSchema,
    bankDetails: bankDetailsSchema,
    skills: [{ type: String, trim: true }],
    about: { type: String, trim: true, maxlength: 2000 },
    onboardingTasks: [onboardingTaskSchema],
    offboarding: {
      lastWorkingDay: Date,
      reason: String,
      exitInterviewDone: { type: Boolean, default: false },
      assetsReturned: { type: Boolean, default: false },
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    // Set when a Super Admin permanently erases the employee. The document itself
    // is kept as an anonymized tombstone so payroll, payslip and audit history keep
    // a valid relationship, and it is excluded from every employee query by isDeleted.
    isPermanentlyDeleted: { type: Boolean, default: false, index: true },
    deletionReference: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

employeeSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// `email` is the official work email used for login. The alias exposes the same
// value under the domain name used by the UI and API clients.
employeeSchema.virtual('workEmail').get(function workEmail() {
  return this.email;
});

employeeSchema.index({ firstName: 'text', lastName: 'text', employeeId: 'text', email: 'text' });
employeeSchema.index({ department: 1, employmentStatus: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
