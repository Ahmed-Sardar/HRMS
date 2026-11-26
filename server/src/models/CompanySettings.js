const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    annualQuota: { type: Number, default: 12, min: 0 },
    isPaid: { type: Boolean, default: true },
    carryForward: { type: Boolean, default: false },
    maxCarryForward: { type: Number, default: 0 },
    requiresApproval: { type: Boolean, default: true },
    color: { type: String, default: '#1e3a8a' },
  },
  { _id: false },
);

// Every statutory deduction is configurable and disabled by default. Rates are
// supplied by the company; the platform does not assume any jurisdiction's law.
const statutorySchema = new mongoose.Schema(
  {
    pfEnabled: { type: Boolean, default: false },
    pfEmployeePercent: { type: Number, default: 12, min: 0, max: 25 },
    pfEmployerPercent: { type: Number, default: 12, min: 0, max: 25 },
    pfWageCeiling: { type: Number, default: 15000, min: 0 },
    esiEnabled: { type: Boolean, default: false },
    esiEmployeePercent: { type: Number, default: 0.75, min: 0, max: 10 },
    esiEmployerPercent: { type: Number, default: 3.25, min: 0, max: 10 },
    esiWageCeiling: { type: Number, default: 21000, min: 0 },
    ptEnabled: { type: Boolean, default: false },
    ptMonthlyAmount: { type: Number, default: 200, min: 0, max: 20000 },
    tdsEnabled: { type: Boolean, default: false },
    tdsPercent: { type: Number, default: 0, min: 0, max: 50 },
  },
  { _id: false },
);

const companySettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'company', unique: true },
    companyName: { type: String, default: 'Acme Corporation', trim: true },
    legalName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    address: { type: String, trim: true },
    logo: { type: String },
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
    currencySymbol: { type: String, default: '\u20b9' },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    workStartTime: { type: String, default: '09:00' },
    workEndTime: { type: String, default: '18:00' },
    gracePeriodMinutes: { type: Number, default: 10 },
    fullDayMinutes: { type: Number, default: 480 },
    halfDayMinutes: { type: Number, default: 240 },
    overtimeMultiplier: { type: Number, default: 1.5 },
    weekendOvertimeMultiplier: { type: Number, default: 2 },
    payrollDay: { type: Number, default: 28, min: 1, max: 31 },
    probationMonths: { type: Number, default: 3 },
    noticePeriodDays: { type: Number, default: 30 },
    fiscalYearStartMonth: { type: Number, default: 4, min: 1, max: 12 },
    attendanceCorrectionWindowDays: { type: Number, default: 7 },
    // Work-from-home policy. 0 disables the monthly cap.
    wfhMonthlyLimit: { type: Number, default: 8, min: 0 },
    wfhRequiresHrApproval: { type: Boolean, default: true },
    wfhMaxAdvanceDays: { type: Number, default: 45, min: 1 },
    wfhPolicyNotes: { type: String, trim: true, maxlength: 1000 },
    enableEmailNotifications: { type: Boolean, default: false },
    statutory: { type: statutorySchema, default: () => ({}) },
    leaveTypes: {
      type: [leaveTypeSchema],
      default: [
        { code: 'SICK', name: 'Sick Leave', annualQuota: 10, isPaid: true, color: '#ef4444' },
        { code: 'CASUAL', name: 'Casual Leave', annualQuota: 12, isPaid: true, color: '#f59e0b' },
        { code: 'EARNED', name: 'Earned Leave', annualQuota: 15, isPaid: true, color: '#10b981' },
        { code: 'UNPAID', name: 'Unpaid Leave', annualQuota: 0, isPaid: false, color: '#64748b' },
      ],
    },
    announcementDefaultRoles: {
      type: [String],
      default: ['SUPER_ADMIN', 'ADMIN', 'HR', 'FINANCE', 'EMPLOYEE'],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('CompanySettings', companySettingsSchema);
