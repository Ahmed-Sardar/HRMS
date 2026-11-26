const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    },
  });
});

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/users', require('../modules/users/user.routes'));
router.use('/employees', require('../modules/employees/employee.routes'));
router.use('/departments', require('../modules/departments/department.routes'));
router.use('/designations', require('../modules/designations/designation.routes'));
router.use('/attendance', require('../modules/attendance/attendance.routes'));
router.use('/shifts', require('../modules/attendance/shift.routes'));
router.use('/holidays', require('../modules/attendance/holiday.routes'));
router.use('/leaves', require('../modules/leave/leave.routes'));
router.use('/wfh', require('../modules/wfh/wfh.routes'));
router.use('/helpdesk', require('../modules/helpdesk/helpdesk.routes'));
router.use('/exits', require('../modules/exit/exit.routes'));
router.use('/performance', require('../modules/performance/performance.routes'));
router.use('/finance', require('../modules/finance/finance.routes'));
router.use('/hr', require('../modules/hr/hr.routes'));
router.use('/payroll', require('../modules/payroll/payroll.routes'));
router.use('/documents', require('../modules/documents/document.routes'));
router.use('/assets', require('../modules/assets/asset.routes'));
router.use('/recruitment', require('../modules/recruitment/recruitment.routes'));
const { notificationRouter, announcementRouter } = require('../modules/notifications/notification.routes');
router.use('/notifications', notificationRouter);
router.use('/announcements', announcementRouter);
router.use('/settings', require('../modules/settings/settings.routes'));
router.use('/automation', require('../modules/automation/automation.routes'));
router.use('/dashboard', require('../modules/dashboard/dashboard.routes'));

module.exports = router;
