const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');
const { logAudit } = require('../../utils/audit');
const service = require('./automation.service');

const router = express.Router();
router.use(protect);

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR];

router.get(
  '/status',
  authorize(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = await service.getAutomationStatus();
    res.json({ success: true, data });
  }),
);

router.post(
  '/reminders/run',
  authorize(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = await service.runReminders();
    await logAudit({
      req,
      actor: req.user,
      action: 'AUTOMATION_REMINDERS_RUN',
      module: 'HR',
      entityType: 'AutomationRun',
      description: `Ran daily reminders manually (${data.created} notification(s))`,
      newValue: data,
    });
    res.json({ success: true, message: `${data.created} reminder notification(s) created`, data });
  }),
);

router.post(
  '/leave/initialize',
  authorize(...ADMIN_ROLES),
  validate({
    body: z.object({
      year: z.coerce.number().min(2000).max(2100).optional(),
      dryRun: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.initializeLeaveBalances({ year: req.body.year, dryRun: req.body.dryRun });
    if (!data.dryRun) {
      await logAudit({
        req,
        actor: req.user,
        action: 'AUTOMATION_LEAVE_INITIALIZED',
        module: 'LEAVE',
        entityType: 'LeaveBalance',
        description: `Initialised leave balances for ${data.year}: ${data.created} created, ${data.updated} updated`,
        newValue: data,
      });
    }
    res.json({
      success: true,
      message: data.dryRun
        ? `Dry run: ${data.created} balance(s) would be created`
        : `Leave balances ready for ${data.year}`,
      data,
    });
  }),
);

router.post(
  '/attendance/auto-absent',
  authorize(...ADMIN_ROLES),
  validate({
    body: z.object({
      date: z.coerce.date().optional(),
      dryRun: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.markAutoAbsent({ date: req.body.date, dryRun: req.body.dryRun });
    if (!data.dryRun) {
      await logAudit({
        req,
        actor: req.user,
        action: 'AUTOMATION_AUTO_ABSENT_RUN',
        module: 'ATTENDANCE',
        entityType: 'Attendance',
        description: `Auto-absent run for ${data.date}: ${data.marked} record(s) marked`,
        newValue: data,
      });
    }
    res.json({
      success: true,
      message: data.workingDay
        ? data.dryRun
          ? `${data.wouldMark} record(s) would be marked absent`
          : `${data.marked} record(s) marked absent`
        : data.reason,
      data,
    });
  }),
);

router.post(
  '/run-all',
  authorize(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = await service.runAllJobs();
    await logAudit({
      req,
      actor: req.user,
      action: 'AUTOMATION_RUN_ALL',
      module: 'HR',
      entityType: 'AutomationRun',
      description: 'Ran all automation jobs manually',
      newValue: data,
    });
    res.json({ success: true, message: 'Automation jobs completed', data });
  }),
);

module.exports = router;
