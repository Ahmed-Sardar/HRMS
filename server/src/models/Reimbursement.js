const mongoose = require('mongoose');
const { REIMBURSEMENT_STATUS } = require('../config/constants');

const reimbursementSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['TRAVEL', 'MEALS', 'MEDICAL', 'INTERNET', 'EQUIPMENT', 'TRAINING', 'OTHER'],
      default: 'OTHER',
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    expenseDate: { type: Date, required: true },
    description: { type: String, trim: true, maxlength: 2000 },
    receipt: {
      originalName: String,
      fileName: String,
      path: String,
      mimetype: String,
      size: Number,
    },
    status: {
      type: String,
      enum: Object.values(REIMBURSEMENT_STATUS),
      default: REIMBURSEMENT_STATUS.PENDING,
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewComment: { type: String, trim: true },
    payrollMonth: String,
    paidAt: Date,
  },
  { timestamps: true },
);

reimbursementSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Reimbursement', reimbursementSchema);
