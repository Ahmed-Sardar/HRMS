const mongoose = require('mongoose');
const { PAYROLL_STATUS } = require('../config/constants');

const payrollLineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
);

const statutorySnapshotSchema = new mongoose.Schema(
  {
    pfEmployee: { type: Number, default: 0 },
    pfEmployer: { type: Number, default: 0 },
    esiEmployee: { type: Number, default: 0 },
    esiEmployer: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    employeeTotal: { type: Number, default: 0 },
    employerTotal: { type: Number, default: 0 },
  },
  { _id: false },
);

const payrollSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    month: { type: String, required: true, index: true }, // YYYY-MM
    year: { type: Number, required: true, index: true },
    salaryStructure: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryStructure' },
    currency: { type: String, default: 'INR' },
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    allowances: { type: [payrollLineSchema], default: [] },
    deductions: { type: [payrollLineSchema], default: [] },
    grossEarnings: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },
    overtimeAmount: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    reimbursementAmount: { type: Number, default: 0 },
    lopDays: { type: Number, default: 0 },
    lopAmount: { type: Number, default: 0 },
    statutory: { type: statutorySnapshotSchema, default: () => ({}) },
    netPay: { type: Number, default: 0 },
    workingDays: { type: Number, default: 0 },
    paidDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    leaveDays: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(PAYROLL_STATUS),
      default: PAYROLL_STATUS.DRAFT,
      index: true,
    },
    notes: { type: String, trim: true },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    paidAt: Date,
    paymentReference: String,
  },
  { timestamps: true },
);

payrollSchema.index({ employee: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
