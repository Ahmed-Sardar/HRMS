const mongoose = require('mongoose');

const attendanceCorrectionSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' },
    date: { type: String, required: true },
    requestedCheckIn: Date,
    requestedCheckOut: Date,
    requestedStatus: {
      type: String,
      enum: ['PRESENT', 'HALF_DAY', 'LATE', 'EARLY_DEPARTURE', 'ON_LEAVE'],
    },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewComment: { type: String, trim: true, maxlength: 1000 },
    originalSnapshot: { type: mongoose.Schema.Types.Mixed },
    appliedAttendance: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' },
  },
  { timestamps: true },
);

attendanceCorrectionSchema.index({ employee: 1, date: 1, status: 1 });

module.exports = mongoose.model('AttendanceCorrection', attendanceCorrectionSchema);
