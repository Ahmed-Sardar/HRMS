const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { ROLES, REPORT_STATUS, LEAVE_STATUS } = require('../../config/constants');
const service = require('../performance/performance.service');
const PerformanceReport = require('../../models/PerformanceReport');
const Employee = require('../../models/Employee');
const LeaveRequest = require('../../models/LeaveRequest');
const { logAudit } = require('../../utils/audit');
const { notifyUsers } = require('../../services/notification.service');
const time = require('../../utils/time');
const ApiError = require('../../utils/ApiError');

const router = express.Router();
router.use(protect, authorize(ROLES.HR, ROLES.SUPER_ADMIN));

const hrStatuses = [
  REPORT_STATUS.FORWARDED_TO_HR,
  REPORT_STATUS.UNDER_HR_REVIEW,
  REPORT_STATUS.HR_APPROVED,
  REPORT_STATUS.HR_REJECTED,
  REPORT_STATUS.COMPLETED,
];

router.get(
  '/reports',
  validate({
    query: z.object({
      page: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
      status: z.enum(Object.values(REPORT_STATUS)).optional(),
      employee: z.string().optional(),
      search: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery || req.query;
    const statuses = query.status ? [query.status] : hrStatuses;
    const data = await service.listReportsByStatuses({ statuses, query });
    res.json({ success: true, data });
  }),
);

router.get(
  '/reports/:id',
  asyncHandler(async (req, res) => {
    const data = await service.getReport({ id: req.params.id, user: req.user });
    res.json({ success: true, data });
  }),
);

router.get(
  '/reports/:id/preview',
  asyncHandler(async (req, res) => {
    const data = await service.previewReport({ id: req.params.id, user: req.user });
    res.json({ success: true, data });
  }),
);

router.get(
  '/reports/:id/export',
  asyncHandler(async (req, res) => {
    await service.exportReport({ id: req.params.id, user: req.user, format: req.query.format, res, req });
  }),
);

router.patch(
  '/reports/:id/review',
  validate({
    body: z.object({
      action: z.enum(['START_HR_REVIEW', 'HR_APPROVE', 'HR_REJECT', 'HR_REQUEST_INFO', 'FORWARD_TO_MANAGER', 'COMPLETE']),
      comments: z.string().max(4000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.transitionReport({
      id: req.params.id,
      user: req.user,
      action: req.body.action,
      comments: req.body.comments,
      req,
    });
    res.json({ success: true, message: 'Report workflow updated', data });
  }),
);

router.patch(
  '/reports/:id/manager-feedback',
  validate({ body: z.object({ managerFeedback: z.string().min(3).max(4000), overallRating: z.coerce.number().min(0).max(5).optional() }) }),
  asyncHandler(async (req, res) => {
    const report = await PerformanceReport.findById(req.params.id);
    if (!report) throw ApiError.notFound('Report not found');
    if (![REPORT_STATUS.UNDER_HR_REVIEW, REPORT_STATUS.HR_APPROVED, REPORT_STATUS.FORWARDED_TO_HR].includes(report.status)) {
      throw ApiError.badRequest('Manager feedback can only be added to reports under HR review');
    }
    if (req.user.employee && String(report.employee) === String(req.user.employee)) {
      throw ApiError.forbidden('You cannot review your own report');
    }
    report.managerFeedback = req.body.managerFeedback;
    if (req.body.overallRating !== undefined) report.overallRating = req.body.overallRating;
    report.managerRatedBy = req.user._id;
    report.managerRatedAt = new Date();
    await report.save();

    await notifyUsers({
      users: [(await Employee.findById(report.employee).select('user')).user].filter(Boolean),
      title: 'Manager feedback added',
      message: `Feedback was added to your performance report '${report.title}'.`,
      type: 'HR',
      link: `/performance/reports/${report._id}`,
    });

    await logAudit({
      req,
      actor: req.user,
      action: 'MANAGER_FEEDBACK_ADDED',
      module: 'HR',
      entityType: 'PerformanceReport',
      entityId: report._id,
      description: `${req.user.name} added manager feedback to '${report.title}'`,
    });

    res.json({ success: true, message: 'Manager feedback saved', data: report });
  }),
);

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const settings = await time.monthKey(new Date());
    const [
      totalEmployees,
      newJoiners,
      onLeave,
      pendingLeaves,
      reportsAwaitingReview,
      approvedReports,
      onboarding,
      recentReports,
      departments,
    ] = await Promise.all([
      Employee.countDocuments({ isDeleted: false, employmentStatus: { $in: ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD'] } }),
      Employee.countDocuments({
        isDeleted: false,
        dateOfJoining: { $gte: time.startOfMonth(new Date()) },
      }),
      LeaveRequest.countDocuments({ status: LEAVE_STATUS.APPROVED, startDate: { $lte: new Date() }, endDate: { $gte: new Date() } }),
      LeaveRequest.countDocuments({ status: LEAVE_STATUS.PENDING }),
      PerformanceReport.countDocuments({ status: { $in: [REPORT_STATUS.FORWARDED_TO_HR, REPORT_STATUS.UNDER_HR_REVIEW] } }),
      PerformanceReport.countDocuments({ status: { $in: [REPORT_STATUS.HR_APPROVED, REPORT_STATUS.COMPLETED] } }),
      Employee.aggregate([
        { $match: { isDeleted: false } },
        { $unwind: { path: '$onboardingTasks', preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: ['$onboardingTasks.completed', 1, 0] } } } },
      ]),
      service.listReportsByStatuses({ statuses: hrStatuses, query: { limit: 6 } }),
      Employee.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
        { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
        { $project: { name: '$department.name', count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        month: settings,
        cards: {
          totalEmployees,
          newJoiners,
          onLeave,
          pendingLeaves,
          reportsAwaitingReview,
          approvedReports,
          onboardingTotal: onboarding[0]?.total || 0,
          onboardingCompleted: onboarding[0]?.completed || 0,
        },
        departments,
        recentReports: recentReports.items,
      },
    });
  }),
);

module.exports = router;
