const mongoose = require('mongoose');
const PerformanceReport = require('../../models/PerformanceReport');
const PerformanceGoal = require('../../models/PerformanceGoal');
const ReportApprovalHistory = require('../../models/ReportApprovalHistory');
const Attendance = require('../../models/Attendance');
const LeaveRequest = require('../../models/LeaveRequest');
const Employee = require('../../models/Employee');
const ApiError = require('../../utils/ApiError');
const {
  REPORT_STATUS,
  REPORTS_PENDING_FINANCE,
  REPORTS_PENDING_HR,
  ROLES,
  LEAVE_STATUS,
  ATTENDANCE_STATUS,
} = require('../../config/constants');
const { getPagination, paginatedResponse } = require('../../utils/pagination');
const { getSettings } = require('../../services/settings.service');
const { logAudit } = require('../../utils/audit');
const { notifyEmployee, notifyRoles } = require('../../services/notification.service');
const { sendExport } = require('../../utils/exports');
const { toStoredFile, deleteStoredFile } = require('../../middleware/upload');
const time = require('../../utils/time');

const EDITABLE_STATUSES = [REPORT_STATUS.DRAFT, REPORT_STATUS.CORRECTION_REQUESTED];
const STAFF_READERS = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.FINANCE];

const recordHistory = async ({ report, actor, action, comments, previousStatus, newStatus, metadata, req }) => {
  await ReportApprovalHistory.create({
    report: report._id,
    employee: report.employee?._id || report.employee,
    actor: actor._id,
    actorRole: actor.role,
    actorName: actor.name,
    action,
    comments,
    previousStatus,
    newStatus,
    metadata,
    ipAddress: req?.ip,
  });
};

const getEmployeeReportOrFail = async (id) => {
  const report = await PerformanceReport.findById(id)
    .populate({
      path: 'employee',
      select: 'employeeId firstName lastName email phone department designation reportingManager dateOfJoining profilePhoto',
      populate: [
        { path: 'department', select: 'name code' },
        { path: 'designation', select: 'title' },
        { path: 'reportingManager', select: 'firstName lastName employeeId' },
      ],
    })
    .populate('reportingManager', 'firstName lastName employeeId');
  if (!report) throw ApiError.notFound('Performance report not found');
  return report;
};

const canViewReport = (user, report) => {
  if (STAFF_READERS.includes(user.role)) return true;
  return user.employee && String(user.employee) === String(report.employee?._id || report.employee);
};

const buildPayload = (payload) => {
  const data = {};
  const fields = [
    'title',
    'periodType',
    'periodStart',
    'periodEnd',
    'selfAssessment',
    'goals',
    'tasksCompleted',
    'kpis',
    'achievements',
    'projectContributions',
    'challenges',
    'skillsDevelopment',
    'employeeComments',
    'overallRating',
  ];
  fields.forEach((field) => {
    if (payload[field] !== undefined) data[field] = payload[field];
  });
  if (data.goals) {
    data.goals = data.goals.map((goal) => ({ ...goal, rating: Math.min(5, Math.max(0, Number(goal.rating) || 0)) }));
  }
  return data;
};

const createReport = async ({ user, employee, payload, req }) => {
  if (!employee) throw ApiError.badRequest('Your account has no employee profile. Contact HR.');
  if (new Date(payload.periodEnd) < new Date(payload.periodStart)) {
    throw ApiError.badRequest('Period end must be after period start');
  }

  const duplicate = await PerformanceReport.findOne({
    employee: employee._id,
    periodType: payload.periodType,
    periodStart: new Date(payload.periodStart),
    periodEnd: new Date(payload.periodEnd),
    status: { $nin: [REPORT_STATUS.FINANCE_REJECTED, REPORT_STATUS.HR_REJECTED] },
  });
  if (duplicate) {
    throw ApiError.conflict('A performance report already exists for this employee and period');
  }

  const report = await PerformanceReport.create({
    ...buildPayload(payload),
    employee: employee._id,
    department: employee.department?._id || employee.department,
    reportingManager: employee.reportingManager?._id || employee.reportingManager,
    status: REPORT_STATUS.DRAFT,
  });

  await recordHistory({
    report,
    actor: user,
    action: 'CREATED',
    comments: 'Report created',
    newStatus: REPORT_STATUS.DRAFT,
    req,
  });

  await logAudit({
    req,
    actor: user,
    action: 'PERFORMANCE_REPORT_CREATED',
    module: 'PERFORMANCE',
    entityType: 'PerformanceReport',
    entityId: report._id,
    description: `${employee.fullName} created performance report '${report.title}'`,
  });

  await syncGoals(employee._id, report);
  return getEmployeeReportOrFail(report._id);
};

const syncGoals = async (employeeId, report) => {
  // Keep the standalone goal tracker aligned with report goals for the same period.
  await PerformanceGoal.deleteMany({ employee: employeeId, periodStart: report.periodStart, periodEnd: report.periodEnd });
  if (!report.goals?.length) return;
  await PerformanceGoal.insertMany(
    report.goals.map((goal) => ({
      employee: employeeId,
      title: goal.title,
      description: goal.description,
      weight: goal.weight,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      progress: goal.status === 'COMPLETED' ? 100 : goal.status === 'IN_PROGRESS' ? 50 : 0,
      status:
        goal.status === 'COMPLETED'
          ? 'ACHIEVED'
          : goal.status === 'AT_RISK'
            ? 'MISSED'
            : goal.status === 'IN_PROGRESS'
              ? 'IN_PROGRESS'
              : 'NOT_STARTED',
    })),
  );
};

const updateReport = async ({ id, user, payload, req }) => {
  const report = await PerformanceReport.findById(id);
  if (!report) throw ApiError.notFound('Performance report not found');
  if (!user.employee || String(report.employee) !== String(user.employee)) {
    throw ApiError.forbidden('You can only edit your own performance reports');
  }
  if (!EDITABLE_STATUSES.includes(report.status)) {
    throw ApiError.badRequest(`A report with status ${report.status} can no longer be edited`);
  }

  const previousStatus = report.status;
  Object.assign(report, buildPayload(payload));
  await report.save();

  if (report.goals) await syncGoals(report.employee, report);

  await recordHistory({
    report,
    actor: user,
    action: 'UPDATED',
    comments: 'Report content updated',
    previousStatus,
    newStatus: report.status,
    req,
  });
  await logAudit({
    req,
    actor: user,
    action: 'PERFORMANCE_REPORT_UPDATED',
    module: 'PERFORMANCE',
    entityType: 'PerformanceReport',
    entityId: report._id,
    description: `Updated performance report '${report.title}'`,
  });

  return getEmployeeReportOrFail(report._id);
};

const submitReport = async ({ id, user, req, comments }) => {
  const report = await PerformanceReport.findById(id);
  if (!report) throw ApiError.notFound('Performance report not found');
  if (!user.employee || String(report.employee) !== String(user.employee)) {
    throw ApiError.forbidden('You can only submit your own performance reports');
  }
  if (!EDITABLE_STATUSES.includes(report.status)) {
    throw ApiError.badRequest(`Only draft or correction-requested reports can be submitted (current: ${report.status})`);
  }
  if (!report.goals?.length && !report.kpis?.length) {
    throw ApiError.badRequest('Add at least one goal or KPI before submitting the report');
  }

  const previousStatus = report.status;
  report.status = REPORT_STATUS.SUBMITTED;
  report.submittedAt = new Date();
  await report.save();

  await recordHistory({
    report,
    actor: user,
    action: 'SUBMITTED',
    comments: comments || 'Submitted for finance verification',
    previousStatus,
    newStatus: REPORT_STATUS.SUBMITTED,
    req,
  });

  const employee = await Employee.findById(report.employee).select('firstName lastName employeeId');
  await notifyRoles(['FINANCE'], {
    title: 'Performance report awaiting verification',
    message: `${employee?.firstName || 'An employee'} ${employee?.lastName || ''} submitted '${report.title}' for finance verification.`,
    type: 'FINANCE',
    link: '/finance/reviews',
  });
  await notifyEmployee(report.employee, {
    title: 'Report submitted',
    message: `Your performance report '${report.title}' was submitted to Finance for verification.`,
    type: 'PERFORMANCE',
    link: `/performance/reports/${report._id}`,
  });

  await logAudit({
    req,
    actor: user,
    action: 'PERFORMANCE_REPORT_SUBMITTED',
    module: 'PERFORMANCE',
    entityType: 'PerformanceReport',
    entityId: report._id,
    description: `Submitted performance report '${report.title}' for finance review`,
  });

  return getEmployeeReportOrFail(report._id);
};

const attachFile = async ({ id, user, file, req }) => {
  const report = await PerformanceReport.findById(id);
  if (!report) throw ApiError.notFound('Performance report not found');
  if (!user.employee || String(report.employee) !== String(user.employee)) {
    throw ApiError.forbidden('You can only attach files to your own reports');
  }
  if (report.status === REPORT_STATUS.COMPLETED || report.status === REPORT_STATUS.HR_APPROVED) {
    throw ApiError.badRequest('This report is locked and cannot be modified');
  }
  const stored = toStoredFile(file, 'reports');
  report.attachments.push({ ...stored, uploadedBy: user._id });
  await report.save();
  await recordHistory({
    report,
    actor: user,
    action: 'ATTACHMENT_ADDED',
    comments: `Attached ${stored.originalName}`,
    req,
  });
  return report.attachments;
};

const removeAttachment = async ({ id, attachmentId, user, req }) => {
  const report = await PerformanceReport.findById(id);
  if (!report) throw ApiError.notFound('Performance report not found');
  if (!user.employee || String(report.employee) !== String(user.employee)) {
    throw ApiError.forbidden('You can only modify your own reports');
  }
  const attachment = report.attachments.id(attachmentId);
  if (!attachment) throw ApiError.notFound('Attachment not found');
  deleteStoredFile(attachment.path);
  attachment.deleteOne();
  await report.save();
  return report.attachments;
};

const listMyReports = async ({ user, query }) => {
  if (!user.employee) throw ApiError.unauthorized();
  const pagination = getPagination(query);
  const filter = { employee: user.employee };
  if (query.status) filter.status = query.status;
  if (query.periodType) filter.periodType = query.periodType;
  if (query.search) filter.title = { $regex: query.search, $options: 'i' };

  const [items, total] = await Promise.all([
    PerformanceReport.find(filter)
      .select('-goals -tasksCompleted -kpis -attachments')
      .sort({ periodStart: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    PerformanceReport.countDocuments(filter),
  ]);

  const counts = await PerformanceReport.aggregate([
    { $match: { employee: new mongoose.Types.ObjectId(user.employee) } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  return {
    ...paginatedResponse(items, total, pagination),
    counts: counts.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
  };
};

const getReport = async ({ id, user }) => {
  const report = await getEmployeeReportOrFail(id);
  if (!canViewReport(user, report)) throw ApiError.forbidden('You are not allowed to view this report');
  const history = await ReportApprovalHistory.find({ report: report._id }).sort({ createdAt: 1 }).lean();
  return { report, history };
};

/** Aggregates attendance + leave data for the report period (never trusted from the client). */
const getReportContext = async (report) => {
  const employeeId = report.employee?._id || report.employee;
  const periodStartKey = time.dateKey(report.periodStart);
  const periodEndKey = time.dateKey(report.periodEnd);

  const [attendance, leaves, employee] = await Promise.all([
    Attendance.find({
      employee: employeeId,
      date: { $gte: periodStartKey, $lte: periodEndKey },
    }).lean(),
    LeaveRequest.find({
      employee: employeeId,
      status: LEAVE_STATUS.APPROVED,
      startDate: { $lte: new Date(report.periodEnd) },
      endDate: { $gte: new Date(report.periodStart) },
    }).lean(),
    Employee.findById(employeeId)
      .populate('department', 'name')
      .populate('designation', 'title')
      .populate('reportingManager', 'firstName lastName employeeId')
      .lean(),
  ]);

  const attendanceSummary = {
    totalDaysMarked: attendance.length,
    present: attendance.filter((item) =>
      [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE, ATTENDANCE_STATUS.EARLY_DEPARTURE, ATTENDANCE_STATUS.WFH].includes(item.status),
    ).length,
    late: attendance.filter((item) => item.status === ATTENDANCE_STATUS.LATE).length,
    halfDays: attendance.filter((item) => item.status === ATTENDANCE_STATUS.HALF_DAY).length,
    absent: attendance.filter((item) => item.status === ATTENDANCE_STATUS.ABSENT).length,
    onLeave: attendance.filter((item) => item.status === ATTENDANCE_STATUS.ON_LEAVE).length,
    effectiveMinutes: attendance.reduce((sum, item) => sum + (item.effectiveMinutes || 0), 0),
    overtimeMinutes: attendance.reduce((sum, item) => sum + (item.overtimeMinutes || 0), 0),
    breakMinutes: attendance.reduce((sum, item) => sum + (item.breakMinutes || 0), 0),
  };

  const leaveSummary = {
    totalRequests: leaves.length,
    totalDays: leaves.reduce((sum, item) => sum + (item.totalDays || 0), 0),
    byType: leaves.reduce((acc, item) => {
      acc[item.leaveType] = (acc[item.leaveType] || 0) + item.totalDays;
      return acc;
    }, {}),
    records: leaves.map((item) => ({
      leaveType: item.leaveType,
      from: time.formatDate(item.startDate),
      to: time.formatDate(item.endDate),
      days: item.totalDays,
    })),
  };

  return { employee, attendanceSummary, leaveSummary, attendance };
};

const buildExportRows = (report) => {
  const goals = report.goals?.length
    ? report.goals
    : [{ title: 'No goals recorded', weight: 0, target: '-', achievement: '-', rating: 0, status: '-' }];
  return goals.map((goal) => ({
    goal: goal.title,
    weight: goal.weight ? `${goal.weight}%` : '-',
    target: goal.target || '-',
    achievement: goal.achievement || '-',
    rating: goal.rating || 0,
    status: goal.status || '-',
  }));
};

const exportReport = async ({ id, user, format, res, req }) => {
  const report = await getEmployeeReportOrFail(id);
  if (!canViewReport(user, report)) throw ApiError.forbidden('You are not allowed to export this report');
  if (!STAFF_READERS.includes(user.role) && report.status === REPORT_STATUS.DRAFT) {
    // employees may export their own drafts
  }
  const settings = await getSettings();
  const context = await getReportContext(report);

  const meta = [
    { label: 'Employee', value: `${report.employee.firstName} ${report.employee.lastName} (${report.employee.employeeId})` },
    { label: 'Department', value: report.employee.department?.name || '-' },
    { label: 'Designation', value: report.employee.designation?.title || '-' },
    { label: 'Reporting Manager', value: report.employee.reportingManager ? `${report.employee.reportingManager.firstName} ${report.employee.reportingManager.lastName}` : '-' },
    { label: 'Period', value: `${report.periodType} | ${time.formatDate(report.periodStart)} - ${time.formatDate(report.periodEnd)}` },
    { label: 'Status', value: report.status.replace(/_/g, ' ') },
    { label: 'Submitted On', value: report.submittedAt ? time.formatDate(report.submittedAt) : 'Not submitted' },
    { label: 'Overall Rating', value: `${report.overallRating || 0} / 5` },
  ];

  const summary = [
    { label: 'Days Present', value: context.attendanceSummary.present },
    { label: 'Late Marks', value: context.attendanceSummary.late },
    { label: 'Half Days', value: context.attendanceSummary.halfDays },
    { label: 'Approved Leave Days', value: context.leaveSummary.totalDays },
    { label: 'Effective Hours', value: time.minutesToDuration(context.attendanceSummary.effectiveMinutes) },
    { label: 'Overtime Hours', value: time.minutesToDuration(context.attendanceSummary.overtimeMinutes) },
    { label: 'Total Goal Weight', value: `${(report.goals || []).reduce((sum, goal) => sum + (goal.weight || 0), 0)}%` },
  ];

  if (format && format !== 'xlsx' && format !== 'excel' && format !== 'csv' && format !== 'pdf') {
    throw ApiError.badRequest('Unsupported export format');
  }

  const narrativeRows = [
    { section: 'Self Assessment', detail: report.selfAssessment || '-' },
    { section: 'Achievements', detail: report.achievements || '-' },
    { section: 'Project Contributions', detail: report.projectContributions || '-' },
    { section: 'Challenges', detail: report.challenges || '-' },
    { section: 'Skills Development', detail: report.skillsDevelopment || '-' },
    { section: 'Employee Comments', detail: report.employeeComments || '-' },
    { section: 'Finance Comments', detail: report.financeComments || '-' },
    { section: 'HR Comments', detail: report.hrComments || '-' },
    { section: 'Manager Feedback', detail: report.managerFeedback || '-' },
  ];

  await logAudit({
    req,
    actor: user,
    action: 'PERFORMANCE_REPORT_EXPORTED',
    module: 'PERFORMANCE',
    entityType: 'PerformanceReport',
    entityId: report._id,
    description: `Exported performance report '${report.title}' as ${format || 'xlsx'}`,
  });

  if (format === 'pdf') {
    const rows = [
      ...buildExportRows(report).map((row) => ({
        goal: row.goal,
        weight: row.weight,
        target: row.target,
        achievement: row.achievement,
        rating: row.rating,
      })),
    ];
    return sendExport(res, {
      format: 'pdf',
      baseName: `performance-report-${report.employee.employeeId}-${time.dateKey(report.periodStart)}`,
      title: `${settings.companyName} - Performance Report`,
      subtitle: `${report.title} (${report.periodType})`,
      meta: [...meta, ...narrativeRows.map((row) => ({ label: row.section, value: row.detail }))],
      columns: [
        { header: 'Goal', key: 'goal', width: 34 },
        { header: 'Weight', key: 'weight', width: 10 },
        { header: 'Target', key: 'target', width: 22 },
        { header: 'Achievement', key: 'achievement', width: 22 },
        { header: 'Rating', key: 'rating', width: 12 },
      ],
      rows,
      summary,
    });
  }

  return sendExport(res, {
    format: format || 'xlsx',
    baseName: `performance-report-${report.employee.employeeId}-${time.dateKey(report.periodStart)}`,
    title: `${settings.companyName} - Performance Report`,
    subtitle: `${report.title} (${report.periodType})`,
    meta,
    columns: [
      { header: 'Goal', key: 'goal', width: 34 },
      { header: 'Weight', key: 'weight', width: 10 },
      { header: 'Target', key: 'target', width: 22 },
      { header: 'Achievement', key: 'achievement', width: 22 },
      { header: 'Rating', key: 'rating', width: 10 },
      { header: 'Status', key: 'status', width: 14 },
    ],
    rows: buildExportRows(report),
    summary,
    sheetName: 'Performance',
  });
};

const previewReport = async ({ id, user }) => {
  const report = await getEmployeeReportOrFail(id);
  if (!canViewReport(user, report)) throw ApiError.forbidden('You are not allowed to view this report');
  const context = await getReportContext(report);
  return {
    report,
    employee: context.employee,
    attendanceSummary: context.attendanceSummary,
    leaveSummary: context.leaveSummary,
  };
};

const deleteDraft = async ({ id, user, req }) => {
  const report = await PerformanceReport.findById(id);
  if (!report) throw ApiError.notFound('Performance report not found');
  if (!user.employee || String(report.employee) !== String(user.employee)) {
    throw ApiError.forbidden('You can only delete your own reports');
  }
  if (report.status !== REPORT_STATUS.DRAFT) throw ApiError.badRequest('Only draft reports can be deleted');
  report.attachments.forEach((item) => deleteStoredFile(item.path));
  await PerformanceReport.deleteOne({ _id: report._id });
  await ReportApprovalHistory.deleteMany({ report: report._id });
  await logAudit({
    req,
    actor: user,
    action: 'PERFORMANCE_REPORT_DELETED',
    module: 'PERFORMANCE',
    entityType: 'PerformanceReport',
    entityId: report._id,
    description: `Deleted draft performance report '${report.title}'`,
  });
  return { success: true };
};

// ---------- Goals tracker ----------
const listGoals = async ({ user, query }) => {
  if (!user.employee) throw ApiError.unauthorized();
  const filter = { employee: user.employee };
  if (query.status) filter.status = query.status;
  return PerformanceGoal.find(filter).sort({ createdAt: -1 }).lean();
};

const createGoal = async ({ user, payload }) => {
  if (!user.employee) throw ApiError.unauthorized();
  if (user.role === ROLES.EMPLOYEE) {
    // employees may only create self goals
  }
  return PerformanceGoal.create({ ...payload, employee: payload.employee || user.employee, createdBy: user._id });
};

const updateGoal = async ({ id, user, payload }) => {
  const goal = await PerformanceGoal.findById(id);
  if (!goal) throw ApiError.notFound('Goal not found');
  const isOwner = user.employee && String(goal.employee) === String(user.employee);
  if (!isOwner && !['SUPER_ADMIN', 'ADMIN', 'HR'].includes(user.role)) {
    throw ApiError.forbidden('You are not allowed to update this goal');
  }
  Object.assign(goal, payload);
  await goal.save();
  return goal;
};

const deleteGoal = async ({ id, user }) => {
  const goal = await PerformanceGoal.findById(id);
  if (!goal) throw ApiError.notFound('Goal not found');
  const isOwner = user.employee && String(goal.employee) === String(user.employee);
  if (!isOwner && !['SUPER_ADMIN', 'ADMIN', 'HR'].includes(user.role)) {
    throw ApiError.forbidden('You are not allowed to delete this goal');
  }
  await PerformanceGoal.deleteOne({ _id: goal._id });
  return { success: true };
};

// ---------- Approval workflow ----------
const TRANSITIONS = {
  START_FINANCE_REVIEW: {
    roles: [ROLES.FINANCE, ROLES.SUPER_ADMIN],
    from: [REPORT_STATUS.SUBMITTED, REPORT_STATUS.UNDER_FINANCE_REVIEW],
    to: REPORT_STATUS.UNDER_FINANCE_REVIEW,
    history: 'FINANCE_REVIEW_STARTED',
  },
  FINANCE_APPROVE: {
    roles: [ROLES.FINANCE, ROLES.SUPER_ADMIN],
    from: [REPORT_STATUS.SUBMITTED, REPORT_STATUS.UNDER_FINANCE_REVIEW],
    to: REPORT_STATUS.FINANCE_APPROVED,
    history: 'FINANCE_APPROVED',
  },
  FINANCE_REJECT: {
    roles: [ROLES.FINANCE, ROLES.SUPER_ADMIN],
    from: [REPORT_STATUS.SUBMITTED, REPORT_STATUS.UNDER_FINANCE_REVIEW],
    to: REPORT_STATUS.FINANCE_REJECTED,
    history: 'FINANCE_REJECTED',
  },
  FINANCE_REQUEST_CORRECTION: {
    roles: [ROLES.FINANCE, ROLES.SUPER_ADMIN],
    from: [REPORT_STATUS.SUBMITTED, REPORT_STATUS.UNDER_FINANCE_REVIEW],
    to: REPORT_STATUS.CORRECTION_REQUESTED,
    history: 'CORRECTION_REQUESTED',
  },
  FORWARD_TO_HR: {
    roles: [ROLES.FINANCE, ROLES.SUPER_ADMIN],
    from: [REPORT_STATUS.FINANCE_APPROVED, REPORT_STATUS.FORWARDED_TO_HR],
    to: REPORT_STATUS.FORWARDED_TO_HR,
    history: 'FORWARDED_TO_HR',
  },
  START_HR_REVIEW: {
    roles: [ROLES.HR, ROLES.SUPER_ADMIN],
    from: [REPORT_STATUS.FORWARDED_TO_HR, REPORT_STATUS.UNDER_HR_REVIEW],
    to: REPORT_STATUS.UNDER_HR_REVIEW,
    history: 'HR_REVIEW_STARTED',
  },
  HR_APPROVE: {
    roles: [ROLES.HR, ROLES.SUPER_ADMIN],
    from: [REPORT_STATUS.FORWARDED_TO_HR, REPORT_STATUS.UNDER_HR_REVIEW],
    to: REPORT_STATUS.HR_APPROVED,
    history: 'HR_APPROVED',
  },
  HR_REJECT: {
    roles: [ROLES.HR, ROLES.SUPER_ADMIN],
    from: [REPORT_STATUS.FORWARDED_TO_HR, REPORT_STATUS.UNDER_HR_REVIEW],
    to: REPORT_STATUS.HR_REJECTED,
    history: 'HR_REJECTED',
  },
  HR_REQUEST_INFO: {
    roles: [ROLES.HR, ROLES.SUPER_ADMIN],
    from: [REPORT_STATUS.FORWARDED_TO_HR, REPORT_STATUS.UNDER_HR_REVIEW],
    to: REPORT_STATUS.CORRECTION_REQUESTED,
    history: 'ADDITIONAL_INFO_REQUESTED',
  },
  FORWARD_TO_MANAGER: {
    roles: [ROLES.HR, ROLES.SUPER_ADMIN],
    from: [REPORT_STATUS.FORWARDED_TO_HR, REPORT_STATUS.UNDER_HR_REVIEW, REPORT_STATUS.HR_APPROVED],
    to: REPORT_STATUS.UNDER_HR_REVIEW,
    history: 'FORWARDED_TO_MANAGER',
  },
  COMPLETE: {
    roles: [ROLES.SUPER_ADMIN, ROLES.HR, ROLES.ADMIN],
    from: [REPORT_STATUS.HR_APPROVED, REPORT_STATUS.UNDER_HR_REVIEW],
    to: REPORT_STATUS.COMPLETED,
    history: 'COMPLETED',
  },
};

const transitionReport = async ({ id, user, action, comments, req }) => {
  const transition = TRANSITIONS[action];
  if (!transition) throw ApiError.badRequest(`Unknown workflow action: ${action}`);
  if (!transition.roles.includes(user.role)) {
    throw ApiError.forbidden(`Your role cannot perform '${action.replace(/_/g, ' ').toLowerCase()}'`);
  }

  const report = await PerformanceReport.findById(id);
  if (!report) throw ApiError.notFound('Performance report not found');

  if (user.employee && String(report.employee) === String(user.employee)) {
    throw ApiError.forbidden('You cannot approve or review your own submission');
  }
  if (!transition.from.includes(report.status)) {
    throw ApiError.badRequest(
      `Cannot ${action.replace(/_/g, ' ').toLowerCase()} while the report is ${report.status.replace(/_/g, ' ').toLowerCase()}`,
    );
  }
  if (['FINANCE_REJECT', 'HR_REJECT', 'FINANCE_REQUEST_CORRECTION', 'HR_REQUEST_INFO'].includes(action) && !comments) {
    throw ApiError.badRequest('A comment is required for this action');
  }

  const previousStatus = report.status;
  report.status = transition.to;

  if (action === 'FINANCE_APPROVE' || action === 'FINANCE_REJECT' || action === 'FINANCE_REQUEST_CORRECTION') {
    report.financeComments = comments || report.financeComments;
    report.financeReviewedAt = new Date();
    report.financeReviewedBy = user._id;
  }
  if (action === 'FINANCE_REQUEST_CORRECTION' || action === 'HR_REQUEST_INFO') {
    report.correctionCount = (report.correctionCount || 0) + 1;
  }
  if (action === 'FORWARD_TO_HR') report.forwardedToHrAt = new Date();
  if (['HR_APPROVE', 'HR_REJECT', 'HR_REQUEST_INFO', 'FORWARD_TO_MANAGER'].includes(action)) {
    report.hrComments = comments || report.hrComments;
    report.hrReviewedAt = new Date();
    report.hrReviewedBy = user._id;
  }
  if (action === 'COMPLETE') report.completedAt = new Date();
  await report.save();

  await recordHistory({
    report,
    actor: user,
    action: transition.history,
    comments,
    previousStatus,
    newStatus: transition.to,
    req,
  });

  const employee = await Employee.findById(report.employee).select('firstName lastName employeeId');
  const isEmployeeFacing = !['START_FINANCE_REVIEW', 'START_HR_REVIEW'].includes(action);

  if (isEmployeeFacing) {
    await notifyEmployee(report.employee, {
      title: `Performance report ${transition.to.replace(/_/g, ' ').toLowerCase()}`,
      message: `'${report.title}' moved to ${transition.to.replace(/_/g, ' ').toLowerCase()}.${comments ? ` Comment: ${comments}` : ''}`,
      type: 'PERFORMANCE',
      link: `/performance/reports/${report._id}`,
    });
  }

  if (action === 'FINANCE_APPROVE') {
    await notifyRoles(['FINANCE'], {
      title: 'Report approved — ready to forward',
      message: `${employee?.firstName || 'Employee'} ${employee?.lastName || ''}'s report '${report.title}' is approved and can be forwarded to HR.`,
      type: 'FINANCE',
      link: '/finance/reviews',
    });
  }
  if (action === 'FORWARD_TO_HR') {
    await notifyRoles(['HR'], {
      title: 'Performance report forwarded to HR',
      message: `'${report.title}' submitted by ${employee?.firstName || ''} ${employee?.lastName || ''} was forwarded to HR for review.`,
      type: 'HR',
      link: '/hr/reviews',
    });
  }
  if (action === 'FINANCE_REJECT' || action === 'FINANCE_REQUEST_CORRECTION') {
    await notifyEmployee(report.employee, {
      title: action === 'FINANCE_REJECT' ? 'Report rejected by Finance' : 'Correction requested by Finance',
      message: `'${report.title}': ${comments || ''}`,
      type: 'FINANCE',
      link: `/performance/reports/${report._id}`,
    });
  }
  if (action === 'FORWARD_TO_MANAGER' && report.reportingManager) {
    const manager = await Employee.findById(report.reportingManager).select('user');
    if (manager?.user) {
      const { notifyUsers } = require('../../services/notification.service');
      await notifyUsers({
        users: [manager.user],
        title: 'Performance report shared for feedback',
        message: `${employee?.firstName || 'An employee'} ${employee?.lastName || ''}'s performance report '${report.title}' was shared with you for feedback.`,
        type: 'PERFORMANCE',
        link: `/performance/reports/${report._id}`,
      });
    }
  }

  await logAudit({
    req,
    actor: user,
    action: `REPORT_${action}`,
    module: action.startsWith('HR') || action.includes('MANAGER') || action === 'COMPLETE' ? 'HR' : 'FINANCE',
    entityType: 'PerformanceReport',
    entityId: report._id,
    description: `${user.name} performed ${action.replace(/_/g, ' ').toLowerCase()} on '${report.title}'`,
    previousValue: { status: previousStatus },
    newValue: { status: transition.to, comments },
  });

  return getEmployeeReportOrFail(report._id);
};

const listReportsByStatuses = async ({ statuses, query, extraMatch = {} }) => {
  const pagination = getPagination(query);
  const filter = { status: { $in: statuses }, ...extraMatch };
  if (query.status) filter.status = query.status;
  if (query.employee) filter.employee = query.employee;
  if (query.periodType) filter.periodType = query.periodType;
  if (query.search) {
    const ids = await Employee.find({
      $or: [
        { firstName: { $regex: query.search, $options: 'i' } },
        { lastName: { $regex: query.search, $options: 'i' } },
        { employeeId: { $regex: query.search, $options: 'i' } },
      ],
      isDeleted: false,
    }).select('_id');
    filter.employee = { $in: ids.map((item) => item._id) };
  }
  if (query.from || query.to) {
    filter.periodStart = {};
    if (query.from) filter.periodStart.$gte = new Date(query.from);
    if (query.to) filter.periodEnd = { $lte: new Date(query.to) };
  }

  const [items, total] = await Promise.all([
    PerformanceReport.find(filter)
      .populate({
        path: 'employee',
        select: 'employeeId firstName lastName department designation',
        populate: [
          { path: 'department', select: 'name' },
          { path: 'designation', select: 'title' },
        ],
      })
      .populate('financeReviewedBy', 'name')
      .populate('hrReviewedBy', 'name')
      .select('-goals -tasksCompleted -kpis')
      .sort({ submittedAt: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    PerformanceReport.countDocuments(filter),
  ]);

  const counts = await PerformanceReport.aggregate([
    { $match: { status: { $in: statuses } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  return {
    ...paginatedResponse(items, total, pagination),
    counts: counts.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
  };
};

const downloadAttachment = async ({ id, attachmentId, user, res, req }) => {
  const report = await PerformanceReport.findById(id);
  if (!report) throw ApiError.notFound('Performance report not found');
  if (!canViewReport(user, report)) throw ApiError.forbidden('You are not allowed to access this report');
  const attachment = report.attachments.id(attachmentId);
  if (!attachment) throw ApiError.notFound('Attachment not found');
  const path = require('path');
  const env = require('../../config/env');
  const absolute = path.resolve(env.uploadsRoot, attachment.path);
  if (!absolute.startsWith(path.resolve(env.uploadsRoot))) throw ApiError.forbidden('Invalid attachment path');
  await logAudit({
    req,
    actor: user,
    action: 'PERFORMANCE_ATTACHMENT_DOWNLOADED',
    module: 'PERFORMANCE',
    entityType: 'PerformanceReport',
    entityId: report._id,
    description: `Downloaded attachment ${attachment.originalName}`,
  });
  return res.download(absolute, attachment.originalName);
};

module.exports = {
  downloadAttachment,
  createReport,
  updateReport,
  submitReport,
  attachFile,
  removeAttachment,
  listMyReports,
  getReport,
  previewReport,
  exportReport,
  deleteDraft,
  transitionReport,
  listReportsByStatuses,
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  TRANSITIONS,
  REPORTS_PENDING_FINANCE,
  REPORTS_PENDING_HR,
};
