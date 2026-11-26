const mongoose = require('mongoose');
const WfhRequest = require('../../models/WfhRequest');
const Employee = require('../../models/Employee');
const Holiday = require('../../models/Holiday');
const LeaveRequest = require('../../models/LeaveRequest');
const ApiError = require('../../utils/ApiError');
const { WFH_STATUS, LEAVE_STATUS } = require('../../config/constants');
const { getPagination, paginatedResponse } = require('../../utils/pagination');
const { getSettings } = require('../../services/settings.service');
const { logAudit } = require('../../utils/audit');
const { notifyEmployee, notifyRoles } = require('../../services/notification.service');
const { markWfhDay } = require('../attendance/attendance.service');
const time = require('../../utils/time');
const { sendExport } = require('../../utils/exports');

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR'];
const ACTIVE_STATUSES = [WFH_STATUS.PENDING, WFH_STATUS.MANAGER_APPROVED, WFH_STATUS.APPROVED];
const BLOCKING_LEAVE = [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED];

const ensureEmployee = (employee) => {
  if (!employee) throw ApiError.badRequest('Your account has no employee profile. Contact HR.');
  return employee;
};

const workingDateKeys = async ({ startDate, endDate, settings }) => {
  const holidays = await Holiday.find({
    date: { $gte: time.startOfDay(startDate), $lte: time.endOfDay(endDate) },
    isActive: true,
    isOptional: false,
  }).lean();
  const holidaySet = new Set(holidays.map((item) => time.dateKey(item.date, settings.timezone)));
  const workingDays = settings.workingDays || [1, 2, 3, 4, 5];
  return time.listDateKeys(startDate, endDate).filter((key) => {
    const dow = time.dayjs(key).day();
    return workingDays.includes(dow) && !holidaySet.has(key);
  });
};

const countDays = async ({ startDate, endDate, dayType, settings }) => {
  if (dayType === 'HALF_DAY') return 0.5;
  const keys = await workingDateKeys({ startDate, endDate, settings });
  return keys.length;
};

/** Days already requested (pending/approved) inside a month, used for the policy cap. */
const monthlyUsage = async (employeeId, month) => {
  const range = time.monthRange(month);
  const requests = await WfhRequest.find({
    employee: employeeId,
    status: { $in: ACTIVE_STATUSES },
    startDate: { $lte: range.end },
    endDate: { $gte: range.start },
  }).lean();
  const approvedDays = requests
    .filter((item) => item.status === WFH_STATUS.APPROVED)
    .reduce((sum, item) => sum + (item.totalDays || 0), 0);
  const reservedDays = requests.reduce((sum, item) => sum + (item.totalDays || 0), 0);
  return { approvedDays, reservedDays, requests: requests.length };
};

const getPolicy = async (employee) => {
  ensureEmployee(employee);
  const settings = await getSettings();
  const month = time.monthKey(new Date(), settings.timezone);
  const usage = await monthlyUsage(employee._id, month);
  const limit = settings.wfhMonthlyLimit ?? 0;
  return {
    month,
    monthlyLimit: limit,
    requiresHrApproval: settings.wfhRequiresHrApproval !== false,
    maxAdvanceDays: settings.wfhMaxAdvanceDays || 45,
    notes: settings.wfhPolicyNotes || '',
    approvedDays: usage.approvedDays,
    reservedDays: usage.reservedDays,
    remaining: limit ? Math.max(0, limit - usage.reservedDays) : null,
  };
};

const applyWfh = async ({ user, employee, payload, req }) => {
  ensureEmployee(employee);
  const settings = await getSettings();
  const policy = await getPolicy(employee);

  const startDate = time.startOfDay(payload.startDate);
  const endDate = time.endOfDay(payload.endDate);
  if (endDate < startDate) throw ApiError.badRequest('End date must be on or after the start date');
  if (payload.dayType === 'HALF_DAY' && time.dateKey(startDate, settings.timezone) !== time.dateKey(endDate, settings.timezone)) {
    throw ApiError.badRequest('A half-day work-from-home request must be for a single date');
  }

  const todayKey = time.dateKey(new Date(), settings.timezone);
  const startKey = time.dateKey(startDate, settings.timezone);
  if (startKey < todayKey) throw ApiError.badRequest('Work-from-home requests cannot start in the past');
  const advanceDays = time.dayjs(startKey).diff(time.dayjs(todayKey), 'day');
  if (advanceDays > policy.maxAdvanceDays) {
    throw ApiError.badRequest(`Requests can only be made up to ${policy.maxAdvanceDays} day(s) in advance`);
  }

  const totalDays = await countDays({ startDate, endDate, dayType: payload.dayType || 'FULL_DAY', settings });
  if (totalDays <= 0) {
    throw ApiError.badRequest('The selected period contains only weekends or holidays. Choose another date range.');
  }

  const overlappingWfh = await WfhRequest.findOne({
    employee: employee._id,
    status: { $in: ACTIVE_STATUSES },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });
  if (overlappingWfh) {
    throw ApiError.conflict('You already have a work-from-home request that overlaps these dates');
  }

  const overlappingLeave = await LeaveRequest.findOne({
    employee: employee._id,
    status: { $in: BLOCKING_LEAVE },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });
  if (overlappingLeave) {
    throw ApiError.conflict('These dates overlap a leave request. Cancel or change it before applying for WFH.');
  }

  if (policy.monthlyLimit) {
    const requestedInMonth = await monthlyUsage(employee._id, time.monthKey(startDate, settings.timezone));
    if (requestedInMonth.reservedDays + totalDays > policy.monthlyLimit) {
      throw ApiError.badRequest(
        `This request exceeds the monthly work-from-home limit of ${policy.monthlyLimit} day(s). Already requested: ${requestedInMonth.reservedDays} day(s).`,
      );
    }
  }

  const request = await WfhRequest.create({
    employee: employee._id,
    workMode: payload.workMode || 'WFH',
    dayType: payload.dayType || 'FULL_DAY',
    halfDaySession: payload.dayType === 'HALF_DAY' ? payload.halfDaySession || 'FIRST_HALF' : null,
    startDate,
    endDate,
    totalDays,
    workLocation: payload.workLocation,
    reason: payload.reason,
    contactNumber: payload.contactNumber,
    handoverTo: payload.handoverTo || undefined,
    approvalLevel: 'PENDING_MANAGER',
    history: [
      {
        action: 'APPLIED',
        level: 'EMPLOYEE',
        by: user._id,
        role: user.role,
        comment: payload.reason,
        newStatus: WFH_STATUS.PENDING,
      },
    ],
  });

  const period = `${time.formatDate(startDate)}${startDate.getTime() === endDate.getTime() ? '' : ` to ${time.formatDate(endDate)}`}`;
  if (employee.reportingManager) {
    await notifyEmployee(employee.reportingManager, {
      title: 'Work-from-home request awaiting approval',
      message: `${employee.fullName} requested ${totalDays} day(s) of ${payload.workMode || 'WFH'} for ${period}.`,
      type: 'LEAVE',
      link: '/wfh/approvals',
    });
  }
  await notifyRoles(['HR', 'ADMIN'], {
    title: 'Work-from-home request submitted',
    message: `${employee.fullName} requested ${totalDays} day(s) of ${payload.workMode || 'WFH'} for ${period}.`,
    type: 'LEAVE',
    link: '/wfh/approvals',
  });

  await logAudit({
    req,
    actor: user,
    action: 'WFH_APPLIED',
    module: 'WFH',
    entityType: 'WfhRequest',
    entityId: request._id,
    description: `${employee.fullName} requested ${totalDays} day(s) of ${payload.workMode || 'WFH'}`,
    newValue: { startDate, endDate, totalDays, workMode: payload.workMode || 'WFH' },
  });

  return request.populate({ path: 'employee', select: 'employeeId firstName lastName' });
};

const listMyWfh = async ({ employee, query }) => {
  ensureEmployee(employee);
  const pagination = getPagination(query);
  const filter = { employee: employee._id };
  if (query.status) filter.status = query.status;
  if (query.month) {
    const range = time.monthRange(query.month);
    filter.startDate = { $lte: range.end };
    filter.endDate = { $gte: range.start };
  }
  const [items, total] = await Promise.all([
    WfhRequest.find(filter)
      .populate({ path: 'reviewedBy', select: 'name role' })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    WfhRequest.countDocuments(filter),
  ]);
  return paginatedResponse(items, total, pagination);
};

const listWfh = async ({ query, user }) => {
  const pagination = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.employee) filter.employee = query.employee;
  if (query.workMode) filter.workMode = query.workMode;
  if (query.month) {
    const range = time.monthRange(query.month);
    filter.startDate = { $lte: range.end };
    filter.endDate = { $gte: range.start };
  }
  if (query.department) {
    const ids = await Employee.find({ department: query.department, isDeleted: false }).select('_id');
    filter.employee = { $in: ids.map((item) => item._id) };
  }
  if (query.search) {
    const ids = await Employee.find({
      isDeleted: false,
      $or: [
        { firstName: { $regex: query.search, $options: 'i' } },
        { lastName: { $regex: query.search, $options: 'i' } },
        { employeeId: { $regex: query.search, $options: 'i' } },
      ],
    }).select('_id');
    filter.employee = { $in: ids.map((item) => item._id) };
  }

  // Non-staff users only see their own requests plus their direct reports.
  if (!STAFF_ROLES.includes(user.role)) {
    const reports = user.employee
      ? await Employee.find({ reportingManager: user.employee, isDeleted: false }).select('_id')
      : [];
    const scope = [user.employee, ...reports.map((item) => item._id)].filter(Boolean);
    if (filter.employee && filter.employee.$in) {
      const allowed = new Set(scope.map(String));
      filter.employee = { $in: filter.employee.$in.filter((id) => allowed.has(String(id))) };
    } else {
      filter.employee = filter.employee ? filter.employee : { $in: scope };
    }
  }

  const [items, total, counts] = await Promise.all([
    WfhRequest.find(filter)
      .populate({
        path: 'employee',
        select: 'employeeId firstName lastName department designation',
        populate: [
          { path: 'department', select: 'name' },
          { path: 'designation', select: 'title' },
        ],
      })
      .populate({ path: 'reviewedBy', select: 'name role' })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    WfhRequest.countDocuments(filter),
    WfhRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return {
    ...paginatedResponse(items, total, pagination),
    counts: counts.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
    canApprove: STAFF_ROLES.includes(user.role),
  };
};

const isReportingManager = async (user, employee) => {
  if (!user.employee || !employee.reportingManager) return false;
  return String(employee.reportingManager) === String(user.employee);
};

const approveFinal = async ({ request, employee, settings, reviewer, req }) => {
  const keys = await workingDateKeys({ startDate: request.startDate, endDate: request.endDate, settings });
  const dates = request.dayType === 'HALF_DAY' ? [time.dateKey(request.startDate, settings.timezone)] : keys;
  await Promise.all(dates.map((key) => markWfhDay(request.employee, key)));

  request.status = WFH_STATUS.APPROVED;
  request.approvalLevel = 'COMPLETE';
  request.reviewedBy = reviewer._id;
  request.reviewedAt = new Date();

  await notifyEmployee(request.employee, {
    title: 'Work-from-home approved',
    message: `Your ${request.workMode} request from ${time.formatDate(request.startDate)} to ${time.formatDate(request.endDate)} has been approved. Attendance has been marked as WFH.`,
    type: 'LEAVE',
    link: '/wfh',
  });

  await logAudit({
    req,
    actor: reviewer,
    action: 'WFH_APPROVED',
    module: 'WFH',
    entityType: 'WfhRequest',
    entityId: request._id,
    description: `WFH request of ${employee.fullName} approved for ${request.totalDays} day(s)`,
    newValue: { status: WFH_STATUS.APPROVED, dates },
  });
};

const reviewWfh = async ({ id, user, payload, req }) => {
  const request = await WfhRequest.findById(id);
  if (!request) throw ApiError.notFound('Work-from-home request not found');
  if (![WFH_STATUS.PENDING, WFH_STATUS.MANAGER_APPROVED].includes(request.status)) {
    throw ApiError.badRequest(`This request has already been ${request.status.toLowerCase().replace(/_/g, ' ')}`);
  }
  if (user.employee && String(request.employee) === String(user.employee)) {
    throw ApiError.forbidden('You cannot review your own work-from-home request');
  }

  const employee = await Employee.findOne({ _id: request.employee, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');

  const settings = await getSettings();
  const staff = STAFF_ROLES.includes(user.role);
  const manager = await isReportingManager(user, employee);
  if (!staff && !manager) {
    throw ApiError.forbidden('Only the reporting manager or HR can review this request');
  }

  const previousStatus = request.status;
  const level = staff ? 'HR' : 'MANAGER';

  if (payload.status === WFH_STATUS.REJECTED) {
    request.status = WFH_STATUS.REJECTED;
    request.approvalLevel = 'COMPLETE';
    request.reviewedBy = user._id;
    request.reviewedAt = new Date();
    request.reviewComment = payload.reviewComment;
    request.approvals.push({ level, decision: 'REJECTED', by: user._id, comment: payload.reviewComment });
    request.history.push({
      action: 'REJECTED',
      level,
      by: user._id,
      role: user.role,
      comment: payload.reviewComment,
      previousStatus,
      newStatus: WFH_STATUS.REJECTED,
    });
  } else if (previousStatus === WFH_STATUS.PENDING && settings.wfhRequiresHrApproval !== false) {
    // Move to the next stage. HR approval is the final step when the policy requires it.
    request.status = WFH_STATUS.MANAGER_APPROVED;
    request.approvalLevel = 'PENDING_HR';
    request.reviewedBy = user._id;
    request.reviewedAt = new Date();
    request.reviewComment = payload.reviewComment;
    request.approvals.push({ level, decision: 'APPROVED', by: user._id, comment: payload.reviewComment });
    request.history.push({
      action: 'MANAGER_APPROVED',
      level,
      by: user._id,
      role: user.role,
      comment: payload.reviewComment,
      previousStatus,
      newStatus: WFH_STATUS.MANAGER_APPROVED,
    });

    if (settings.wfhRequiresHrApproval !== false) {
      await notifyRoles(['HR', 'ADMIN'], {
        title: 'Work-from-home awaiting HR approval',
        message: `${employee.fullName}'s ${request.workMode} request for ${time.formatDate(request.startDate)} needs HR approval.`,
        type: 'LEAVE',
        link: '/wfh/approvals',
      });
    }
  } else {
    if (previousStatus === WFH_STATUS.MANAGER_APPROVED && !staff) {
      throw ApiError.forbidden('This request needs HR approval');
    }
    request.approvals.push({ level: staff ? 'HR' : 'MANAGER', decision: 'APPROVED', by: user._id, comment: payload.reviewComment });
    request.history.push({
      action: 'APPROVED',
      level: 'HR',
      by: user._id,
      role: user.role,
      comment: payload.reviewComment,
      previousStatus,
      newStatus: WFH_STATUS.APPROVED,
    });
    await approveFinal({ request, employee, settings, reviewer: user, req });
  }

  await request.save();
  return request.populate({ path: 'employee', select: 'employeeId firstName lastName' });
};

const clearWfhAttendance = async ({ request, settings }) => {
  const keys = request.dayType === 'HALF_DAY'
    ? [time.dateKey(request.startDate, settings.timezone)]
    : time.listDateKeys(request.startDate, request.endDate);
  if (!keys.length) return;
  const Attendance = mongoose.model('Attendance');
  await Attendance.deleteMany({
    employee: request.employee,
    date: { $in: keys },
    status: 'WFH',
    checkIn: null,
    source: 'SYSTEM',
  });
};

const cancelWfh = async ({ id, user, employee, req }) => {
  const request = await WfhRequest.findById(id);
  if (!request) throw ApiError.notFound('Work-from-home request not found');
  if (!employee || String(request.employee) !== String(employee._id)) {
    throw ApiError.forbidden('You can only cancel your own work-from-home requests');
  }
  if (!ACTIVE_STATUSES.includes(request.status)) {
    throw ApiError.badRequest('Only pending or approved requests can be cancelled');
  }
  const settings = await getSettings();
  if (time.dateKey(request.startDate, settings.timezone) <= time.dateKey(new Date(), settings.timezone)) {
    throw ApiError.badRequest('Requests that have already started cannot be cancelled. Contact HR.');
  }

  const previousStatus = request.status;
  if (request.status === WFH_STATUS.APPROVED) {
    await clearWfhAttendance({ request, settings });
  }
  request.status = WFH_STATUS.CANCELLED;
  request.approvalLevel = 'COMPLETE';
  request.history.push({
    action: 'CANCELLED',
    level: 'EMPLOYEE',
    by: user._id,
    role: user.role,
    previousStatus,
    newStatus: WFH_STATUS.CANCELLED,
  });
  await request.save();

  await logAudit({
    req,
    actor: user,
    action: 'WFH_CANCELLED',
    module: 'WFH',
    entityType: 'WfhRequest',
    entityId: request._id,
    description: `WFH request cancelled by ${user.name}`,
    previousValue: { status: previousStatus },
  });

  return request;
};

const teamCalendar = async ({ query, user, employee }) => {
  const settings = await getSettings();
  const month = query.month || time.monthKey(new Date(), settings.timezone);
  const range = time.monthRange(month, settings.timezone);
  const filter = {
    status: WFH_STATUS.APPROVED,
    startDate: { $lte: range.end },
    endDate: { $gte: range.start },
  };

  if (query.department) {
    const ids = await Employee.find({ department: query.department, isDeleted: false }).select('_id');
    filter.employee = { $in: ids.map((item) => item._id) };
  } else if (!STAFF_ROLES.includes(user.role) && employee) {
    const record = await Employee.findById(employee._id).select('department');
    const teammates = await Employee.find({
      $or: [{ department: record.department }, { reportingManager: record._id }],
      isDeleted: false,
    }).select('_id');
    filter.employee = { $in: teammates.map((item) => item._id) };
  }

  const requests = await WfhRequest.find(filter)
    .populate({ path: 'employee', select: 'employeeId firstName lastName department', populate: { path: 'department', select: 'name' } })
    .lean();

  return {
    month: range.month,
    requests: requests.map((item) => ({
      ...item,
      dates: time.listDateKeys(
        item.startDate < range.start ? range.start : item.startDate,
        item.endDate > range.end ? range.end : item.endDate,
      ),
    })),
  };
};

const exportWfh = async ({ query, res, user }) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.month) {
    const range = time.monthRange(query.month);
    filter.startDate = { $lte: range.end };
    filter.endDate = { $gte: range.start };
  }
  if (!STAFF_ROLES.includes(user.role) && user.employee) filter.employee = user.employee;

  const requests = await WfhRequest.find(filter)
    .populate({ path: 'employee', select: 'employeeId firstName lastName department', populate: { path: 'department', select: 'name' } })
    .sort({ startDate: -1 })
    .limit(5000)
    .lean();
  const settings = await getSettings();

  return sendExport(res, {
    format: query.format || 'xlsx',
    baseName: 'wfh-report',
    title: `${settings.companyName} - Work From Home Report`,
    subtitle: `Status: ${query.status || 'All'} | Month: ${query.month || 'All'}`,
    meta: [{ label: 'Generated by', value: user.name }],
    columns: [
      { header: 'Employee ID', key: 'employeeId', width: 14 },
      { header: 'Employee', key: 'name', width: 22 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Mode', key: 'workMode', width: 12 },
      { header: 'Day Type', key: 'dayType', width: 12 },
      { header: 'From', key: 'from', width: 14 },
      { header: 'To', key: 'to', width: 14 },
      { header: 'Days', key: 'days', width: 8 },
      { header: 'Status', key: 'status', width: 18 },
    ],
    rows: requests.map((item) => ({
      employeeId: item.employee?.employeeId || '',
      name: item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
      department: item.employee?.department?.name || '',
      workMode: item.workMode,
      dayType: item.dayType,
      from: time.formatDate(item.startDate),
      to: time.formatDate(item.endDate),
      days: item.totalDays,
      status: item.status,
    })),
    summary: [
      { label: 'Total requests', value: requests.length },
      { label: 'Approved days', value: requests.filter((item) => item.status === WFH_STATUS.APPROVED).reduce((sum, item) => sum + (item.totalDays || 0), 0) },
    ],
  });
};

const getPendingSummary = async () => {
  const [pendingManager, pendingHr, approvedThisMonth] = await Promise.all([
    WfhRequest.countDocuments({ status: WFH_STATUS.PENDING }),
    WfhRequest.countDocuments({ status: WFH_STATUS.MANAGER_APPROVED }),
    WfhRequest.countDocuments({ status: WFH_STATUS.APPROVED, startDate: { $gte: time.startOfMonth(new Date()), $lte: time.endOfMonth(new Date()) } }),
  ]);
  return { pendingManager, pendingHr, approvedThisMonth };
};

module.exports = {
  getPolicy,
  applyWfh,
  listMyWfh,
  listWfh,
  reviewWfh,
  cancelWfh,
  teamCalendar,
  exportWfh,
  getPendingSummary,
  monthlyUsage,
};
