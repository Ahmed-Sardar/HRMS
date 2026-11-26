const mongoose = require('mongoose');

const componentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['FIXED', 'PERCENTAGE'], default: 'FIXED' },
    taxable: { type: Boolean, default: true },
  },
  { _id: false },
);

const salaryStructureSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: Date,
    currency: { type: String, default: 'INR' },
    basic: { type: Number, required: true, min: 0 },
    hra: { type: Number, default: 0, min: 0 },
    allowances: { type: [componentSchema], default: [] },
    deductions: { type: [componentSchema], default: [] },
    employerContributions: { type: [componentSchema], default: [] },
    overtimeEligible: { type: Boolean, default: true },
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

salaryStructureSchema.index({ employee: 1, effectiveFrom: -1 });

salaryStructureSchema.virtual('totalAllowances').get(function totalAllowances() {
  const percentage = (this.allowances || [])
    .filter((item) => item.type === 'PERCENTAGE')
    .reduce((sum, item) => sum + (this.basic * item.amount) / 100, 0);
  const fixed = (this.allowances || [])
    .filter((item) => item.type !== 'PERCENTAGE')
    .reduce((sum, item) => sum + item.amount, 0);
  return fixed + percentage;
});

salaryStructureSchema.virtual('grossSalary').get(function grossSalary() {
  return (this.basic || 0) + (this.hra || 0) + this.totalAllowances;
});

salaryStructureSchema.virtual('totalDeductions').get(function totalDeductions() {
  return (this.deductions || []).reduce((sum, item) => sum + item.amount, 0);
});

module.exports = mongoose.model('SalaryStructure', salaryStructureSchema);
