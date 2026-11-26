const express = require('express');
const { z } = require('zod');
const Role = require('../../models/Role');
const AuditLog = require('../../models/AuditLog');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { getSettings, updateSettings } = require('../../services/settings.service');
const { logAudit } = require('../../utils/audit');
const { ROLES } = require('../../config/constants');
const { ROLE_PERMISSIONS } = require('../../config/permissions');
const { getPagination, paginatedResponse } = require('../../utils/pagination');

const router = express.Router();
router.use(protect);

const leaveTypeSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(60),
  annualQuota: z.coerce.number().min(0),
  isPaid: z.boolean().optional(),
  carryForward: z.boolean().optional(),
  maxCarryForward: z.coerce.number().min(0).optional(),
  requiresApproval: z.boolean().optional(),
  color: z.string().optional(),
});

const statutoryBody = z.object({
  pfEnabled: z.boolean().optional(),
  pfEmployeePercent: z.coerce.number().min(0).max(25).optional(),
  pfEmployerPercent: z.coerce.number().min(0).max(25).optional(),
  pfWageCeiling: z.coerce.number().min(0).optional(),
  esiEnabled: z.boolean().optional(),
  esiEmployeePercent: z.coerce.number().min(0).max(10).optional(),
  esiEmployerPercent: z.coerce.number().min(0).max(10).optional(),
  esiWageCeiling: z.coerce.number().min(0).optional(),
  ptEnabled: z.boolean().optional(),
  ptMonthlyAmount: z.coerce.number().min(0).max(20000).optional(),
  tdsEnabled: z.boolean().optional(),
  tdsPercent: z.coerce.number().min(0).max(50).optional(),
});

const settingsBody = z.object({
  companyName: z.string().min(2).max(160).optional(),
  legalName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  logo: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  currencySymbol: z.string().optional(),
  workingDays: z.array(z.coerce.number().min(0).max(6)).optional(),
  workStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  workEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  gracePeriodMinutes: z.coerce.number().min(0).max(120).optional(),
  fullDayMinutes: z.coerce.number().min(60).max(720).optional(),
  halfDayMinutes: z.coerce.number().min(30).max(360).optional(),
  overtimeMultiplier: z.coerce.number().min(1).max(3).optional(),
  weekendOvertimeMultiplier: z.coerce.number().min(1).max(3).optional(),
  payrollDay: z.coerce.number().min(1).max(31).optional(),
  probationMonths: z.coerce.number().min(0).max(24).optional(),
  noticePeriodDays: z.coerce.number().min(0).max(180).optional(),
  fiscalYearStartMonth: z.coerce.number().min(1).max(12).optional(),
  attendanceCorrectionWindowDays: z.coerce.number().min(1).max(60).optional(),
  wfhMonthlyLimit: z.coerce.number().min(0).max(31).optional(),
  wfhRequiresHrApproval: z.boolean().optional(),
  wfhMaxAdvanceDays: z.coerce.number().min(1).max(365).optional(),
  wfhPolicyNotes: z.string().max(1000).optional(),
  enableEmailNotifications: z.boolean().optional(),
  statutory: statutoryBody.optional(),
  leaveTypes: z.array(leaveTypeSchema).optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({ success: true, data: settings });
}));

router.patch(
  '/',
  authorize(ROLES.SUPER_ADMIN),
  validate({ body: settingsBody }),
  asyncHandler(async (req, res) => {
    const previous = (await getSettings()).toObject();
    const settings = await updateSettings(req.body);
    await logAudit({
      req,
      actor: req.user,
      action: 'SETTINGS_UPDATED',
      module: 'SETTINGS',
      entityType: 'CompanySettings',
      entityId: settings._id,
      description: 'Updated company settings',
      previousValue: {
        workingDays: previous.workingDays,
        workStartTime: previous.workStartTime,
        workEndTime: previous.workEndTime,
      },
      newValue: req.body,
    });
    res.json({ success: true, message: 'Settings updated', data: settings });
  }),
);

router.get('/roles', asyncHandler(async (req, res) => {
  const roles = await Role.find({}).sort({ createdAt: 1 }).lean();
  res.json({
    success: true,
    data: roles.length
      ? roles
      : Object.entries(ROLE_PERMISSIONS).map(([slug, permissions]) => ({ slug, permissions })),
  });
}));

router.get(
  '/audit',
  authorize(ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const pagination = getPagination(req.query);
    const filter = {};
    if (req.query.module) filter.module = req.query.module;
    if (req.query.actor) filter.actor = req.query.actor;
    if (req.query.search) {
      filter.$or = [
        { action: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { actorName: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ success: true, data: paginatedResponse(items, total, pagination) });
  }),
);

router.get('/activity/my', asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query);
  const [items, total] = await Promise.all([
    AuditLog.find({ actor: req.user._id }).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    AuditLog.countDocuments({ actor: req.user._id }),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, pagination) });
}));

module.exports = router;
