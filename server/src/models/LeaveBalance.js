const mongoose = require('mongoose');

const balanceEntrySchema = new mongoose.Schema(
  {
    type: { type: String, required: true, uppercase: true, trim: true },
    allocated: { type: Number, default: 0, min: 0 },
    used: { type: Number, default: 0, min: 0 },
    pending: { type: Number, default: 0, min: 0 },
    carriedForward: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    year: { type: Number, required: true, index: true },
    balances: { type: [balanceEntrySchema], default: [] },
  },
  { timestamps: true },
);

leaveBalanceSchema.index({ employee: 1, year: 1 }, { unique: true });

leaveBalanceSchema.methods.ensureTypes = function ensureTypes(leaveTypes = []) {
  leaveTypes.forEach((type) => {
    if (!this.balances.find((entry) => entry.type === type.code)) {
      this.balances.push({
        type: type.code,
        allocated: type.annualQuota || 0,
        used: 0,
        pending: 0,
        carriedForward: 0,
      });
    }
  });
};

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
