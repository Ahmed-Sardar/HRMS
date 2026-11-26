const mongoose = require('mongoose');
const LeaveRequest = require('../../models/LeaveRequest');
const LeaveBalance = require('../../models/LeaveBalance');
const Holiday = require('../../models/Holiday');
const Employee = require('../../models/Employee');
const ApiError = require('../../utils/ApiError');
const { LEAVE_STATUS } = require('../../config/constants');
const { getPagination, paginatedResponse } = require('../../utils/pagination');
const { getSettings } = require('../../services/settings.service');
const { logAudit } = require('../../utils/audit');
const { notifyEmployee, notifyRoles } = require('../../services/notification.service');
const { markLeaveDay } = require('../attendance/attendance.service');
const time = require('../../utils/time');
const { sendExport } = require('../../utils/exports');

const getLeaveTypeMeta = async (code) => {
  const settings = await getSettings();
  const type = (settings.leaveTypes || []).find((item) => item.code === String(code).toUpperCase());
  if (!type) throw ApiError.badRequest(`Unknown leave type: ${code}`);
  return { type, settings };
};

const getOrCreateBalance = async (employeeId, year) => {
  const settings = await getSettings();
  let balance = await LeaveBalance.findOne({ employee: employeeId, year });
  if (!balance) {
    balance = await LeaveBalance.create({
      employee: employeeId,
      year,
      balances: (settings.leaveTypes || []).map((type) => ({
        type: type.code,
        allocated: type.annualQuota || 0,
        used: 0,
        pending: 0,
        carriedForward: 0,
      })),
    });
  } else {
    const before = balance.balances.length;
    balance.ensureTypes(settings.leaveTypes || []);
    if (balance.balances.length !== before) await balance.save();
  }
  return balance;
};

const getMyBalances = async (employee) => {
  if (!employee) throw ApiError.unauthorized();
  const year = time.yearOf();
  const balance = await getOrCreateBalance(employee._id, year);
  const settings = await getSettings();
  const items = balance.balances.map((entry) => {
    const meta = (settings.leaveTypes || []).find((type) => type.code === entry.type);
    const available = (entry.allocated || 0) + (entry.carriedForward || 0) - (entry.used || 0) - (entry.pending || 0);
    return {
      type: entry.type,
      name: meta?.name || entry.type,
      isPaid: meta?.isPaid !== false,
      color: meta?.color || '#1e3a8a',
      allocated: entry.allocated,
      carriedForward: entry.carriedForward,
      used: entry.used,
      pending: entry.pending,
      available: Math.max(0, Number(available.toFixed(2))),
    };
  });
  return { year, balances: items, totalAvailable: items.filter((item) => item.name !== 'Unpaid Leave').reduce((sum, item) => sum + item.available, 0) };
};

const countLeaveDays = async ({ startDate, endDate, isHalfDay }) => {
  const settings = await getSettings();
  const tz = settings.timezone;
  if (isHalfDay) return 0.5;
  const keys = time.listDateKeys(startDate, endDate);
  const holidays = await Holiday.find({
    date: { $gte: time.startOfDay(startDate), $lte: time.endOfDay(endDate) },
    isActive: true,
    isOptional: false,
  }).lean();
  const holidaySet = new Set(holidays.map((item) => time.dateKey(item.date, tz)));
  let days = 0;
  keys.forEach((key) => {
    const dow = time.dayjs(key).day();
    if ((settings.workingDays || [1, 2, 3, 4, 5]).includes(dow) && !holidaySet.has(key)) days += 1;
  });
  return days;
};

const applyLeave = async ({ user, employee, payload, req }) => {
  if (!employee) throw ApiError.badRequest('Your account has no employee profile. Contact HR.');
  const { type } = await getLeaveTypeMeta(payload.leaveType);
  const settings = await getSettings();

  const startDate = time.startOfDay(payload.startDate);
  const endDate = time.endOfDay(payload.endDate);
  if (endDate < startDate) throw ApiError.badRequest('End date must be on or after the start date');

  const totalDays = await countLeaveDays({ startDate, endDate, isHalfDay: payload.isHalfDay });
  if (totalDays <= 0) {
    throw ApiError.badRequest('The selected period contains only weekends or holidays. Choose another date range.');
  }
  if (payload.isHalfDay && time.dateKey(startDate, settings.timezone) !== time.dateKey(endDate, settings.timezone)) {
    throw ApiError.badRequest('A half-day leave must be requested for a single date');
  }

  const overlapping = await LeaveRequest.findOne({
    employee: employee._id,
    status: { $in: [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });
  if (overlapping) {
    throw ApiError.conflict('You already have a pending or approved leave request that overlaps these dates');
  }

  const year = time.yearOf(startDate);
  const balance = await getOrCreateBalance(employee._id, year);
  const entry = balance.balances.find((item) => item.type === type.code);

  if (type.isPaid) {
    if (!entry) throw ApiError.badRequest(`No leave balance configured for ${type.name}`);
    const available = (entry.allocated || 0) + (entry.carriedForward || 0) - (entry.used || 0) - (entry.pending || 0);
    if (available < totalDays) {
      throw ApiError.badRequest(
        `Insufficient ${type.name} balance. Available: ${available} day(s), requested: ${totalDays} day(s).`,
      );
    }
    entry.pending = Number(((entry.pending || 0) + totalDays).toFixed(2));
    await balance.save();
  }

  const leave = await LeaveRequest.create({
    employee: employee._id,
    leaveType: type.code,
    startDate,
    endDate,
    isHalfDay: payload.isHalfDay || false,
    halfDaySession: payload.isHalfDay ? payload.halfDaySession || 'FIRST_HALF' : null,
    totalDays,
    reason: payload.reason,
    contactDuringLeave: payload.contactDuringLeave,
    handoverTo: payload.handoverTo,
    status: LEAVE_STATUS.PENDING,
    history: [
      {
        action: 'APPLIED',
        by: user._id,
        role: user.role,
        comment: payload.reason,
        newStatus: LEAVE_STATUS.PENDING,
      },
    ],
  });

  await notifyRoles(['HR', 'ADMIN'], {
    title: 'New leave request',
    message: `${employee.fullName} applied for ${totalDays} day(s) ${type.name} from ${time.formatDate(startDate)} to ${time.formatDate(endDate)}.`,
    type: 'LEAVE',
    link: '/leave/approvals',
  });

  await logAudit({
    req,
    actor: user,
    action: 'LEAVE_APPLIED',
    module: 'LEAVE',
    entityType: 'LeaveRequest',
    entityId: leave._id,
    description: `${employee.fullName} applied for ${totalDays} day(s) ${type.name}`,
    newValue: { startDate, endDate, totalDays, leaveType: type.code },
  });

  return leave.populate({ path: 'employee', select: 'employeeId firstName lastName' });
};

const listMyLeaves = async ({ employee, query }) => {
  if (!employee) throw ApiError.unauthorized();
  const pagination = getPagination(query);
  const filter = { employee: employee._id };
  if (query.status) filter.status = query.status;
  if (query.leaveType) filter.leaveType = query.leaveType;
  if (query.year) {
    filter.startDate = {
      $gte: new Date(`${query.year}-01-01T00:00:00.000Z`),
      $lte: new Date(`${query.year}-12-31T23:59:59.999Z`),
    };
  }
  const settings = await getSettings();
  const [items, total, summary] = await Promise.all([
    LeaveRequest.find(filter)
      .populate({ path: 'reviewedBy', select: 'name role' })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    LeaveRequest.countDocuments(filter),
    LeaveRequest.aggregate([
      { $match: { employee: new mongoose.Types.ObjectId(employee._id), status: LEAVE_STATUS.APPROVED } },
      { $group: { _id: '$leaveType', days: { $sum: '$totalDays' }, count: { $sum: 1 } } },
    ]),
  ]);

  return {
    ...paginatedResponse(
      items.map((item) => ({
        ...item,
        typeName: (settings.leaveTypes || []).find((type) => type.code === item.leaveType)?.name || item.leaveType,
      })),
      total,
      pagination,
    ),
    summary,
  };
};

const listLeaves = async ({ query }) => {
  const pagination = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.leaveType) filter.leaveType = query.leaveType;
  if (query.employee) filter.employee = query.employee;
  if (query.department) {
    const ids = await Employee.find({ department: query.department, isDeleted: false }).select('_id');
    filter.employee = { $in: ids.map((item) => item._id) };
  }
  if (query.from || query.to) {
    filter.startDate = {};
    if (query.from) filter.startDate.$gte = time.startOfDay(query.from);
    if (query.to) filter.endDate = { $lte: time.endOfDay(query.to) };
  }
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

  const [items, total] = await Promise.all([
    LeaveRequest.find(filter)
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
    LeaveRequest.countDocuments(filter),
  ]);

  const counts = await LeaveRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  return {
    ...paginatedResponse(items, total, pagination),
    counts: counts.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
  };
};

const reviewLeave = async ({ id, user, payload, req }) => {
  const leave = await LeaveRequest.findById(id);
  if (!leave) throw ApiError.notFound('Leave request not found');
  if (leave.status !== LEAVE_STATUS.PENDING) {
    throw ApiError.badRequest(`This leave request has already been ${leave.status.toLowerCase()}`);
  }
  if (user.employee && String(leave.employee) === String(user.employee)) {
    throw ApiError.forbidden('You cannot review your own leave request');
  }

  const employee = await Employee.findById(leave.employee);
  if (!employee) throw ApiError.notFound('Employee not found');

  const { type } = await getLeaveTypeMeta(leave.leaveType);
  const year = time.yearOf(leave.startDate);
  const balance = await getOrCreateBalance(leave.employee, year);
  const entry = balance.balances.find((item) => item.type === leave.leaveType);

  const previousStatus = leave.status;
  leave.status = payload.status;
  leave.reviewedBy = user._id;
  leave.reviewedAt = new Date();
  leave.reviewComment = payload.reviewComment;
  leave.history.push({
    action: payload.status === LEAVE_STATUS.APPROVED ? 'APPROVED' : 'REJECTED',
    by: user._id,
    role: user.role,
    at: new Date(),
    comment: payload.reviewComment,
    previousStatus,
    newStatus: payload.status,
  });

  if (payload.status === LEAVE_STATUS.APPROVED) {
    if (type.isPaid && entry) {
      entry.pending = Math.max(0, Number(((entry.pending || 0) - leave.totalDays).toFixed(2)));
      entry.used = Number(((entry.used || 0) + leave.totalDays).toFixed(2));
      await balance.save();
    }
    const settings = await getSettings();
    const keys = time.listDateKeys(leave.startDate, leave.endDate);
    await Promise.all(keys.map((key) => markLeaveDay(leave.employee, key)));
    void settings;
  } else if (type.isPaid && entry) {
    entry.pending = Math.max(0, Number(((entry.pending || 0) - leave.totalDays).toFixed(2)));
    await balance.save();
  }

  await leave.save();

  await notifyEmployee(leave.employee, {
    title: `Leave request ${payload.status.toLowerCase()}`,
    message: `Your ${type.name} request from ${time.formatDate(leave.startDate)} to ${time.formatDate(leave.endDate)} was ${payload.status.toLowerCase()}.${
      payload.reviewComment ? ` Comment: ${payload.reviewComment}` : ''
    }`,
    type: 'LEAVE',
    link: '/leave/my',
  });

  await logAudit({
    req,
    actor: user,
    action: `LEAVE_${payload.status}`,
    module: 'LEAVE',
    entityType: 'LeaveRequest',
    entityId: leave._id,
    description: `${user.name} ${payload.status.toLowerCase()} leave request of ${employee.fullName}`,
    previousValue: { status: previousStatus },
    newValue: { status: payload.status, comment: payload.reviewComment },
  });

  return leave;
};

const cancelLeave = async ({ id, user, employee, req }) => {
  const leave = await LeaveRequest.findById(id);
  if (!leave) throw ApiError.notFound('Leave request not found');
  if (!employee || String(leave.employee) !== String(employee._id)) {
    throw ApiError.forbidden('You can only cancel your own leave requests');
  }
  if (leave.status !== LEAVE_STATUS.PENDING) {
    throw ApiError.badRequest('Only pending leave requests can be cancelled');
  }

  const { type } = await getLeaveTypeMeta(leave.leaveType);
  const balance = await getOrCreateBalance(leave.employee, time.yearOf(leave.startDate));
  const entry = balance.balances.find((item) => item.type === leave.leaveType);
  if (type.isPaid && entry) {
    entry.pending = Math.max(0, Number(((entry.pending || 0) - leave.totalDays).toFixed(2)));
    await balance.save();
  }

  leave.status = LEAVE_STATUS.CANCELLED;
  leave.history.push({
    action: 'CANCELLED',
    by: user._id,
    role: user.role,
    at: new Date(),
    previousStatus: LEAVE_STATUS.PENDING,
    newStatus: LEAVE_STATUS.CANCELLED,
  });
  await leave.save();

  await logAudit({
    req,
    actor: user,
    action: 'LEAVE_CANCELLED',
    module: 'LEAVE',
    entityType: 'LeaveRequest',
    entityId: leave._id,
    description: `Leave request cancelled by ${user.name}`,
  });

  return leave;
};

const teamCalendar = async ({ query, user }) => {
  const settings = await getSettings();
  const month = query.month || time.monthKey(new Date(), settings.timezone);
  const range = time.monthRange(month, settings.timezone);
  const filter = {
    status: { $in: [LEAVE_STATUS.APPROVED, LEAVE_STATUS.PENDING] },
    startDate: { $lte: range.end },
    endDate: { $gte: range.start },
  };

  if (query.department) {
    const ids = await Employee.find({ department: query.department, isDeleted: false }).select('_id');
    filter.employee = { $in: ids.map((item) => item._id) };
  } else if (['EMPLOYEE', 'FINANCE'].includes(user.role) && user.employee) {
    const employee = await Employee.findById(user.employee).select('department reportingManager');
    const teammates = await Employee.find({
      $or: [{ department: employee.department }, { reportingManager: employee._id }],
      isDeleted: false,
    }).select('_id');
    filter.employee = { $in: teammates.map((item) => item._id) };
  }

  const leaves = await LeaveRequest.find(filter)
    .populate({ path: 'employee', select: 'employeeId firstName lastName department', populate: { path: 'department', select: 'name' } })
    .lean();
  const holidays = await Holiday.find({ date: { $gte: range.start, $lte: range.end }, isActive: true }).lean();

  return {
    month: range.month,
    leaves: leaves.map((item) => ({
      ...item,
      dates: time.listDateKeys(
        item.startDate < range.start ? range.start : item.startDate,
        item.endDate > range.end ? range.end : item.endDate,
      ),
    })),
    holidays,
  };
};

const getPendingSummary = async (employeeIds = null) => {
  const filter = { status: LEAVE_STATUS.PENDING };
  if (employeeIds) filter.employee = { $in: employeeIds };
  const [pending, onLeaveToday] = await Promise.all([
    LeaveRequest.countDocuments(filter),
    LeaveRequest.countDocuments({
      status: LEAVE_STATUS.APPROVED,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }),
  ]);
  return { pending, onLeaveToday };
};

const exportLeaves = async ({ query, res, user }) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.leaveType) filter.leaveType = query.leaveType;
  if (['EMPLOYEE'].includes(user.role) && user.employee) filter.employee = user.employee;
  if (query.from || query.to) {
    filter.startDate = {};
    if (query.from) filter.startDate.$gte = time.startOfDay(query.from);
    if (query.to) filter.endDate = { $lte: time.endOfDay(query.to) };
  }

  const leaves = await LeaveRequest.find(filter)
    .populate({ path: 'employee', select: 'employeeId firstName lastName department', populate: { path: 'department', select: 'name' } })
    .populate('reviewedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();
  const settings = await getSettings();

  const rows = leaves.map((item) => ({
    employeeId: item.employee?.employeeId || '',
    name: item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
    department: item.employee?.department?.name || '',
    leaveType: (settings.leaveTypes || []).find((type) => type.code === item.leaveType)?.name || item.leaveType,
    from: time.formatDate(item.startDate),
    to: time.formatDate(item.endDate),
    days: item.totalDays,
    status: item.status,
    appliedOn: time.formatDate(item.appliedAt),
    reviewedBy: item.reviewedBy?.name || '-',
    comment: item.reviewComment || '',
  }));

  return sendExport(res, {
    format: query.format || 'xlsx',
    baseName: 'leave-report',
    title: `${settings.companyName} - Leave Report`,
    subtitle: `Status: ${query.status || 'All'} | Type: ${query.leaveType || 'All'}`,
    meta: [{ label: 'Generated by', value: user.name }],
    columns: [
      { header: 'Employee ID', key: 'employeeId', width: 14 },
      { header: 'Employee', key: 'name', width: 22 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Leave Type', key: 'leaveType', width: 16 },
      { header: 'From', key: 'from', width: 14 },
      { header: 'To', key: 'to', width: 14 },
      { header: 'Days', key: 'days', width: 8 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Applied On', key: 'appliedOn', width: 14 },
      { header: 'Reviewed By', key: 'reviewedBy', width: 18 },
      { header: 'Comment', key: 'comment', width: 30 },
    ],
    rows,
    summary: [
      { label: 'Total requests', value: rows.length },
      { label: 'Total days', value: leaves.reduce((sum, item) => sum + (item.totalDays || 0), 0) },
    ],
  });
};

module.exports = {
  getMyBalances,
  applyLeave,
  listMyLeaves,
  listLeaves,
  reviewLeave,
  cancelLeave,
  teamCalendar,
  getPendingSummary,
  exportLeaves,
  getOrCreateBalance,
};
