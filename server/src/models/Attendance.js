const mongoose = require('mongoose');
const { ATTENDANCE_STATUS } = require('../config/constants');

const breakSchema = new mongoose.Schema(
  {
    start: { type: Date, required: true },
    end: { type: Date, default: null },
    durationMinutes: { type: Number, default: 0 },
    type: { type: String, enum: ['SHORT', 'LUNCH', 'PERSONAL', 'OTHER'], default: 'LUNCH' },
  },
  { _id: true },
);

const attendanceEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'CHECK_IN',
        'BREAK_START',
        'BREAK_END',
        'CHECK_OUT',
        'CORRECTION_APPLIED',
        'MANUAL_OVERRIDE',
        'SYSTEM_MARK',
      ],
    },
    at: { type: Date, default: Date.now },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD in company timezone
    attendanceDate: { type: Date, required: true, index: true },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    breaks: { type: [breakSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.ABSENT,
      index: true,
    },
    workedMinutes: { type: Number, default: 0 },
    breakMinutes: { type: Number, default: 0 },
    effectiveMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    earlyDepartureMinutes: { type: Number, default: 0 },
    isLate: { type: Boolean, default: false },
    source: { type: String, enum: ['SELF', 'CORRECTION', 'SYSTEM', 'ADMIN'], default: 'SELF' },
    notes: { type: String, trim: true, maxlength: 1000 },
    correction: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceCorrection' },
    events: { type: [attendanceEventSchema], default: [] },
    originalEvents: { type: [attendanceEventSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1, status: 1 });

attendanceSchema.virtual('activeBreak').get(function activeBreak() {
  return (this.breaks || []).find((b) => !b.end) || null;
});

attendanceSchema.methods.recalculateBreakMinutes = function recalculateBreakMinutes() {
  this.breakMinutes = (this.breaks || []).reduce((total, item) => total + (item.durationMinutes || 0), 0);
};

module.exports = mongoose.model('Attendance', attendanceSchema);
module.exports.BreakSchema = breakSchema;
