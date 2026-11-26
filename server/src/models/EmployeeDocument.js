const mongoose = require('mongoose');
const { DOCUMENT_STATUS } = require('../config/constants');

const employeeDocumentSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    title: { type: String, required: [true, 'Document title is required'], trim: true },
    category: {
      type: String,
      required: true,
      enum: [
        'RESUME',
        'IDENTITY',
        'EDUCATION',
        'EMPLOYMENT',
        'OFFER_LETTER',
        'APPOINTMENT_LETTER',
        'EXPERIENCE_LETTER',
        'PAYSLIP',
        'OTHER',
      ],
      index: true,
    },
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    path: { type: String, required: true },
    mimetype: String,
    size: Number,
    issueDate: Date,
    expiryDate: Date,
    status: {
      type: String,
      enum: Object.values(DOCUMENT_STATUS),
      default: DOCUMENT_STATUS.PENDING,
      index: true,
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    verificationComment: { type: String, trim: true },
    isConfidential: { type: Boolean, default: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false, index: true },
    downloadCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

employeeDocumentSchema.index({ employee: 1, category: 1, isDeleted: 1 });
employeeDocumentSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('EmployeeDocument', employeeDocumentSchema);
