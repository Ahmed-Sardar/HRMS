const mongoose = require('mongoose');

/**
 * Payslip stores the immutable snapshot of a payroll run so historical
 * payslips never change when salary structures are updated later.
 */
const payslipSchema = new mongoose.Schema(
  {
    payroll: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll', required: true, unique: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    month: { type: String, required: true, index: true },
    number: { type: String, required: true, unique: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emailedAt: Date,
    downloadCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Payslip', payslipSchema);
