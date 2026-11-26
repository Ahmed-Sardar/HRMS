const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { ROLES, REPORT_STATUS, REPORT_PERIOD_TYPES } = require('../../config/constants');
const service = require('../performance/performance.service');
const Reimbursement = require('../../models/Reimbursement');
const Payroll = require('../../models/Payroll');
const SalaryStructure = require('../../models/SalaryStructure');
const Employee = require('../../models/Employee');
const { getSettings } = require('../../services/settings.service');
const { notifyEmployee, notifyUsers } = require('../../services/notification.service');
const { logAudit } = require('../../utils/audit');
const { getPagination, paginatedResponse } = require('../../utils/pagination');
const ApiError = require('../../utils/ApiError');
const { sendExport } = require('../../utils/exports');
const time = require('../../utils/time');

const router = express.Router();
router.use(protect, authorize(ROLES.FINANCE, ROLES.SUPER_ADMIN));

const financeQueueStatuses = [
  REPORT_STATUS.SUBMITTED,
  REPORT_STATUS.UNDER_FINANCE_REVIEW,
  REPORT_STATUS.FINANCE_APPROVED,
  REPORT_STATUS.FINANCE_REJECTED,
  REPORT_STATUS.CORRECTION_REQUESTED,
  REPORT_STATUS.FORWARDED_TO_HR,
  REPORT_STATUS.UNDER_HR_REVIEW,
  REPORT_STATUS.HR_APPROVED,
  REPORT_STATUS.HR_REJECTED,
  REPORT_STATUS.COMPLETED,
];

const listQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(Object.values(REPORT_STATUS)).optional(),
  employee: z.string().optional(),
  periodType: z.enum(REPORT_PERIOD_TYPES).optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

router.get(
  '/reports',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery || req.query;
    const statuses = query.status ? [query.status] : financeQueueStatuses;
    const data = await service.listReportsByStatuses({ statuses, query });
    res.json({ success: true, data });
  }),
);

router.get('/reports/:id', asyncHandler(async (req, res) => {
  const data = await service.getReport({ id: req.params.id, user: req.user });
  res.json({ success: true, data });
}));

router.get('/reports/:id/preview', asyncHandler(async (req, res) => {
  const data = await service.previewReport({ id: req.params.id, user: req.user });
  res.json({ success: true, data });
}));

router.get('/reports/:id/export', asyncHandler(async (req, res) => {
  await service.exportReport({ id: req.params.id, user: req.user, format: req.query.format, res, req });
}));

router.get('/reports/:id/attachment/:attachmentId', asyncHandler(async (req, res) => {
  const data = await service.getReport({ id: req.params.id, user: req.user });
  const attachment = (data.report.attachments || []).find((item) => String(item._id) === req.params.attachmentId);
  if (!attachment) throw ApiError.notFound('Attachment not found');
  const env = require('../../config/env');
  const path = require('path');
  const absolute = path.resolve(env.uploadsRoot, attachment.path);
  if (!absolute.startsWith(path.resolve(env.uploadsRoot))) throw ApiError.forbidden('Invalid attachment path');
  res.download(absolute, attachment.originalName);
}));

const actionBody = z.object({
  action: z.enum(['START_FINANCE_REVIEW', 'FINANCE_APPROVE', 'FINANCE_REJECT', 'FINANCE_REQUEST_CORRECTION', 'FORWARD_TO_HR']),
  comments: z.string().max(4000).optional(),
});

router.patch(
  '/reports/:id/review',
  validate({ body: actionBody }),
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

// ---------- Reimbursements ----------
router.get(
  '/reimbursements',
  asyncHandler(async (req, res) => {
    const pagination = getPagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.employee) filter.employee = req.query.employee;
    if (req.query.month) filter.payrollMonth = req.query.month;
    const [items, total] = await Promise.all([
      Reimbursement.find(filter)
        .populate({ path: 'employee', select: 'employeeId firstName lastName department', populate: { path: 'department', select: 'name' } })
        .populate('reviewedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Reimbursement.countDocuments(filter),
    ]);
    const totals = await Reimbursement.aggregate([
      { $match: filter },
      { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    res.json({
      success: true,
      data: {
        ...paginatedResponse(items, total, pagination),
        totals: totals.reduce((acc, item) => ({ ...acc, [item._id]: item }), {}),
      },
    });
  }),
);

router.patch(
  '/reimbursements/:id/review',
  validate({
    body: z.object({
      status: z.enum(['APPROVED', 'REJECTED', 'PAID']),
      reviewComment: z.string().max(1000).optional(),
      payrollMonth: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const reimbursement = await Reimbursement.findById(req.params.id).populate('employee', 'firstName lastName firstName user');
    if (!reimbursement) throw ApiError.notFound('Reimbursement not found');
    reimbursement.status = req.body.status;
    reimbursement.reviewedBy = req.user._id;
    reimbursement.reviewedAt = new Date();
    reimbursement.reviewComment = req.body.reviewComment;
    if (req.body.payrollMonth) reimbursement.payrollMonth = req.body.payrollMonth;
    if (req.body.status === 'PAID') reimbursement.paidAt = new Date();
    await reimbursement.save();

    await notifyEmployee(reimbursement.employee._id || reimbursement.employee, {
      title: `Reimbursement ${req.body.status.toLowerCase()}`,
      message: `Your reimbursement '${reimbursement.title}' of ${reimbursement.amount} was ${req.body.status.toLowerCase()}.`,
      type: 'FINANCE',
      link: '/finance/reimbursements',
    });

    await logAudit({
      req,
      actor: req.user,
      action: `REIMBURSEMENT_${req.body.status}`,
      module: 'REIMBURSEMENT',
      entityType: 'Reimbursement',
      entityId: reimbursement._id,
      description: `${req.user.name} marked reimbursement '${reimbursement.title}' as ${req.body.status}`,
      newValue: { status: req.body.status, comment: req.body.reviewComment },
    });

    res.json({ success: true, message: 'Reimbursement updated', data: reimbursement });
  }),
);

// ---------- Finance dashboard ----------
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const month = req.query.month || time.monthKey(new Date());
    const [
      awaitingVerification,
      approvedReports,
      rejectedReports,
      forwardedToHr,
      payrollPending,
      payrollApproved,
      reimbursementTotals,
      monthlyPayroll,
      reportsAwaitingFinance,
      recentReports,
    ] = await Promise.all([
      service.listReportsByStatuses({ statuses: [REPORT_STATUS.SUBMITTED, REPORT_STATUS.UNDER_FINANCE_REVIEW], query: { limit: 5 } }),
      require('../../models/PerformanceReport').countDocuments({ status: REPORT_STATUS.FINANCE_APPROVED }),
      require('../../models/PerformanceReport').countDocuments({ status: REPORT_STATUS.FINANCE_REJECTED }),
      require('../../models/PerformanceReport').countDocuments({ status: REPORT_STATUS.FORWARDED_TO_HR }),
      Payroll.countDocuments({ month, status: 'DRAFT' }),
      Payroll.countDocuments({ month, status: 'APPROVED' }),
      Reimbursement.aggregate([{ $match: { status: 'PENDING' } }, { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Payroll.aggregate([
        { $match: { month } },
        { $group: { _id: null, net: { $sum: '$netPay' }, gross: { $sum: '$grossEarnings' }, count: { $sum: 1 } } },
      ]),
      require('../../models/PerformanceReport').countDocuments({
        status: { $in: [REPORT_STATUS.SUBMITTED, REPORT_STATUS.UNDER_FINANCE_REVIEW] },
      }),
      service.listReportsByStatuses({ statuses: financeQueueStatuses, query: { limit: 6, page: 1 } }),
    ]);

    const structures = await SalaryStructure.countDocuments({ isActive: true });

    res.json({
      success: true,
      data: {
        month,
        cards: {
          awaitingVerification: reportsAwaitingFinance,
          approvedReports,
          rejectedReports,
          forwardedToHr,
          payrollPending,
          payrollApproved,
          salaryStructures: structures,
          pendingReimbursements: reimbursementTotals[0]?.count || 0,
          pendingReimbursementAmount: reimbursementTotals[0]?.amount || 0,
          monthNetPayroll: monthlyPayroll[0]?.net || 0,
          monthGrossPayroll: monthlyPayroll[0]?.gross || 0,
          monthPayrollCount: monthlyPayroll[0]?.count || 0,
        },
        recentReports: awaitingVerification.items,
        latestReports: recentReports.items,
      },
    });
  }),
);

// ---------- Financial summary export ----------
router.get(
  '/summary/export',
  asyncHandler(async (req, res) => {
    const month = req.query.month || time.monthKey(new Date());
    const [payrolls, reimbursements, settings] = await Promise.all([
      Payroll.find({ month }).populate('employee', 'employeeId firstName lastName department').lean(),
      Reimbursement.find({ status: { $in: ['APPROVED', 'PAID'] } }).populate('employee', 'employeeId firstName lastName').lean(),
      getSettings(),
    ]);

    const rows = payrolls.map((item) => ({
      employeeId: item.employee?.employeeId || '',
      name: item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
      month: item.month,
      gross: item.grossEarnings,
      deductions: item.totalDeductions,
      overtime: item.overtimeAmount,
      net: item.netPay,
      status: item.status,
    }));

    await logAudit({
      req,
      actor: req.user,
      action: 'FINANCE_SUMMARY_EXPORTED',
      module: 'FINANCE',
      description: `Exported payroll financial summary for ${month}`,
    });

    return sendExport(res, {
      format: req.query.format || 'xlsx',
      baseName: `financial-summary-${month}`,
      title: `${settings.companyName} - Financial Summary`,
      subtitle: `Payroll period ${month}`,
      meta: [
        { label: 'Generated by', value: req.user.name },
        { label: 'Reimbursements (approved/paid)', value: reimbursements.reduce((sum, item) => sum + item.amount, 0) },
      ],
      columns: [
        { header: 'Employee ID', key: 'employeeId', width: 16 },
        { header: 'Employee', key: 'name', width: 24 },
        { header: 'Month', key: 'month', width: 12 },
        { header: 'Gross', key: 'gross', width: 14 },
        { header: 'Deductions', key: 'deductions', width: 14 },
        { header: 'Overtime', key: 'overtime', width: 12 },
        { header: 'Net Pay', key: 'net', width: 14 },
        { header: 'Status', key: 'status', width: 12 },
      ],
      rows,
      summary: [
        { label: 'Employees', value: rows.length },
        { label: 'Total gross', value: rows.reduce((sum, row) => sum + row.gross, 0) },
        { label: 'Total net', value: rows.reduce((sum, row) => sum + row.net, 0) },
      ],
    });
  }),
);

module.exports = router;
