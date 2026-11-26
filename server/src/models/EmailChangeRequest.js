const mongoose = require('mongoose');

const EMAIL_TYPES = ['WORK', 'PERSONAL'];
const REQUEST_STATUSES = ['PENDING_VERIFICATION', 'APPLIED', 'CANCELLED', 'EXPIRED', 'REJECTED'];

/**
 * Single collection that serves both as pending verification request and as
 * email change history. OTP/token hashes are excluded from queries by default
 * and are never returned to clients.
 */
const emailChangeRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emailType: { type: String, enum: EMAIL_TYPES, required: true },
    previousEmail: { type: String, lowercase: true, trim: true },
    newEmail: { type: String, default: '', lowercase: true, trim: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedByName: { type: String, trim: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedByName: { type: String, trim: true },
    status: { type: String, enum: REQUEST_STATUSES, default: 'PENDING_VERIFICATION', index: true },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'EXPIRED', 'NOT_REQUIRED'],
      default: 'PENDING',
    },
    approvalStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    otpHash: { type: String, select: false },
    tokenHash: { type: String, select: false },
    expiresAt: Date,
    attempts: { type: Number, default: 0 },
    verifiedAt: Date,
    appliedAt: Date,
    reason: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

emailChangeRequestSchema.index({ employee: 1, createdAt: -1 });
emailChangeRequestSchema.index({ employee: 1, emailType: 1, status: 1 });

/** Fields that are safe to return to a client (no OTP/token hashes). */
emailChangeRequestSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    _id: this._id,
    employee: this.employee,
    user: this.user,
    emailType: this.emailType,
    previousEmail: this.previousEmail,
    newEmail: this.newEmail,
    requestedBy: this.requestedBy,
    requestedByName: this.requestedByName,
    changedBy: this.changedBy,
    changedByName: this.changedByName,
    status: this.status,
    verificationStatus: this.verificationStatus,
    approvalStatus: this.approvalStatus,
    expiresAt: this.expiresAt,
    verifiedAt: this.verifiedAt,
    appliedAt: this.appliedAt,
    reason: this.reason,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('EmailChangeRequest', emailChangeRequestSchema);
module.exports.EMAIL_TYPES = EMAIL_TYPES;
