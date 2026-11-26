const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const ExitRequest = require('../../models/ExitRequest');
const Employee = require('../../models/Employee');
const CompanyAsset = require('../../models/CompanyAsset');
const LeaveBalance = require('../../models/LeaveBalance');
const SalaryStructure = require('../../models/SalaryStructure');
const Payroll = require('../../models/Payroll');
const ApiError = require('../../utils/ApiError');
const { EXIT_STATUS, EXIT_TYPE, CLEARANCE_DEPARTMENT, ASSET_STATUS, EMPLOYMENT_STATUS } = require('../../config/constants');
const { getPagination, paginatedResponse } = require('../../utils/pagination');
const { getSettings } = require('../../services/settings.service');
const { logAudit } = require('../../utils/audit');
const { notifyEmployee, notifyRoles } = require('../../services/notification.service');
const { sanitize } = require('../../utils/exports/pdf');
const { sendExport } = require('../../utils/exports');
const time = require('../../utils/time');

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR'];
const OPEN_STATUSES = [
  EXIT_STATUS.PENDING_MANAGER,
  EXIT_STATUS.PENDING_HR,
  EXIT_STATUS.APPROVED,
  EXIT_STATUS.IN_PROGRESS,
];

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const isStaff = (user) => STAFF_ROLES.includes(user.role);

const ensureEmployee = (employee) => {
  if (!employee) throw ApiError.badRequest('Your account has no employee profile. Contact HR.');
  return employee;
};

const canManage = async (user, request) => {
  if (isStaff(user)) return true;
  if (!user.employee) return false;
  const employee = await Employee.findById(request.employee).select('reportingManager');
  return Boolean(employee?.reportingManager) && String(employee.reportingManager) === String(user.employee);
};

const buildClearances = () =>
  Object.values(CLEARANCE_DEPARTMENT).map((department) => ({ department, status: 'PENDING' }));

const snapshotAssets = async (employeeId) => {
  const assets = await CompanyAsset.find({ assignedTo: employeeId, isDeleted: false }).lean();
  return assets.map((asset) => ({
    asset: asset._id,
    assetTag: asset.assetTag,
    name: asset.name,
    returned: false,
  }));
};

const defaultLastWorkingDay = (resignationDate, noticeDays) => time.addDays(resignationDate, noticeDays);

const submitResignation = async ({ user, employee, payload, req }) => {
  ensureEmployee(employee);
  const settings = await getSettings();
  const existing = await ExitRequest.findOne({ employee: employee._id, status: { $in: OPEN_STATUSES } });
  if (existing) throw ApiError.conflict('You already have an exit request in progress');

  const resignationDate = payload.resignationDate ? time.startOfDay(payload.resignationDate) : time.startOfDay(new Date());
  const noticePeriodDays = payload.noticePeriodDays ?? settings.noticePeriodDays ?? 30;
  const requestedLastWorkingDay = payload.requestedLastWorkingDay
    ? time.startOfDay(payload.requestedLastWorkingDay)
    : defaultLastWorkingDay(resignationDate, noticePeriodDays);

  if (requestedLastWorkingDay < resignationDate) {
    throw ApiError.badRequest('The last working day cannot be before the resignation date');
  }

  const request = await ExitRequest.create({
    employee: employee._id,
    exitType: payload.exitType || EXIT_TYPE.RESIGNATION,
    resignationDate,
    requestedLastWorkingDay,
    noticePeriodDays,
    reason: payload.reason,
    status: EXIT_STATUS.PENDING_MANAGER,
    clearances: buildClearances(),
    assets: await snapshotAssets(employee._id),
    history: [
      {
        action: 'RESIGNATION_SUBMITTED',
        by: user._id,
        comment: payload.reason,
        newStatus: EXIT_STATUS.PENDING_MANAGER,
      },
    ],
  });

  if (employee.reportingManager) {
    await notifyEmployee(employee.reportingManager, {
      title: 'Resignation awaiting your review',
      message: `${employee.fullName} submitted a resignation effective ${time.formatDate(requestedLastWorkingDay)}.`,
      type: 'HR',
      link: '/exit',
    });
  }
  await notifyRoles(['HR', 'ADMIN'], {
    title: 'Resignation submitted',
    message: `${employee.fullName} (${employee.employeeId}) submitted a resignation. Last working day requested: ${time.formatDate(requestedLastWorkingDay)}.`,
    type: 'HR',
    link: '/exit',
  });

  await logAudit({
    req,
    actor: user,
    action: 'RESIGNATION_SUBMITTED',
    module: 'EXIT',
    entityType: 'ExitRequest',
    entityId: request._id,
    description: `${employee.fullName} submitted a resignation`,
    newValue: { resignationDate, requestedLastWorkingDay, reason: payload.reason },
  });

  return request;
};

const initiateExit = async ({ user, payload, req }) => {
  const employee = await Employee.findOne({ _id: payload.employee, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');
  const existing = await ExitRequest.findOne({ employee: employee._id, status: { $in: OPEN_STATUSES } });
  if (existing) throw ApiError.conflict('This employee already has an exit request in progress');

  const settings = await getSettings();
  const resignationDate = time.startOfDay(payload.resignationDate || new Date());
  const lastWorkingDay = time.startOfDay(payload.approvedLastWorkingDay || payload.requestedLastWorkingDay);
  if (lastWorkingDay < resignationDate) throw ApiError.badRequest('The last working day cannot be before the notice date');

  const request = await ExitRequest.create({
    employee: employee._id,
    exitType: payload.exitType || EXIT_TYPE.TERMINATION,
    resignationDate,
    requestedLastWorkingDay: lastWorkingDay,
    approvedLastWorkingDay: lastWorkingDay,
    noticePeriodDays: payload.noticePeriodDays ?? settings.noticePeriodDays ?? 30,
    reason: payload.reason,
    status: EXIT_STATUS.APPROVED,
    hrReview: { decision: 'APPROVED', by: user._id, comment: payload.reason },
    clearances: buildClearances(),
    assets: await snapshotAssets(employee._id),
    history: [
      {
        action: 'EXIT_INITIATED',
        by: user._id,
        comment: payload.reason,
        newStatus: EXIT_STATUS.APPROVED,
      },
    ],
  });

  employee.employmentStatus = EMPLOYMENT_STATUS.NOTICE_PERIOD;
  employee.dateOfExit = lastWorkingDay;
  await employee.save();

  await notifyEmployee(employee._id, {
    title: 'Exit process initiated',
    message: `An exit process has been initiated for you with last working day ${time.formatDate(lastWorkingDay)}. Please complete your clearances.`,
    type: 'HR',
    link: '/exit',
  });

  await logAudit({
    req,
    actor: user,
    action: 'EXIT_INITIATED',
    module: 'EXIT',
    entityType: 'ExitRequest',
    entityId: request._id,
    description: `Exit initiated for ${employee.fullName}`,
    newValue: { exitType: request.exitType, lastWorkingDay },
  });

  return request;
};

const listMine = async ({ employee, query }) => {
  ensureEmployee(employee);
  const pagination = getPagination(query);
  const filter = { employee: employee._id };
  const [items, total] = await Promise.all([
    ExitRequest.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    ExitRequest.countDocuments(filter),
  ]);
  return paginatedResponse(items, total, pagination);
};

const listExits = async ({ query, user }) => {
  const pagination = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.exitType) filter.exitType = query.exitType;
  if (query.employee) filter.employee = query.employee;
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

  // Line managers only see resignations raised by their direct reports.
  if (user && !isStaff(user) && user.role !== 'FINANCE') {
    const reports = user.employee
      ? await Employee.find({ reportingManager: user.employee, isDeleted: false }).select('_id')
      : [];
    filter.employee = { $in: reports.map((item) => item._id) };
  }

  const [items, total, counts] = await Promise.all([
    ExitRequest.find(filter)
      .populate({
        path: 'employee',
        select: 'employeeId firstName lastName department designation dateOfJoining employmentStatus',
        populate: [
          { path: 'department', select: 'name' },
          { path: 'designation', select: 'title' },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    ExitRequest.countDocuments(filter),
    ExitRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return {
    ...paginatedResponse(items, total, pagination),
    counts: counts.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
  };
};

const getExit = async ({ id, user }) => {
  const request = await ExitRequest.findById(id)
    .populate({
      path: 'employee',
      select: 'employeeId firstName lastName email department designation reportingManager dateOfJoining employmentStatus profilePhoto',
      populate: [
        { path: 'department', select: 'name' },
        { path: 'designation', select: 'title' },
        { path: 'reportingManager', select: 'firstName lastName employeeId' },
      ],
    })
    .populate('managerReview.by', 'name role')
    .populate('hrReview.by', 'name role')
    .populate('clearances.clearedBy', 'name')
    .populate('exitInterview.interviewer', 'name')
    .populate('settlement.approvedBy', 'name')
    .populate('completedBy', 'name');
  if (!request) throw ApiError.notFound('Exit request not found');

  const owner = user.employee && String(request.employee._id) === String(user.employee);
  const managerId = request.employee.reportingManager?._id || request.employee.reportingManager;
  const manager = Boolean(user.employee) && Boolean(managerId) && String(managerId) === String(user.employee);
  if (!owner && !manager && !isStaff(user) && user.role !== 'FINANCE') {
    throw ApiError.forbidden('You are not allowed to access this exit request');
  }

  return request;
};

const managerReview = async ({ id, user, payload, req }) => {
  const request = await ExitRequest.findById(id);
  if (!request) throw ApiError.notFound('Exit request not found');
  if (request.status !== EXIT_STATUS.PENDING_MANAGER) {
    throw ApiError.badRequest('This exit request is not awaiting manager review');
  }
  if (!(await canManage(user, request))) {
    throw ApiError.forbidden('Only the reporting manager or HR can review this resignation');
  }
  const employee = await Employee.findById(request.employee);
  if (!employee) throw ApiError.notFound('Employee not found');

  const previousStatus = request.status;
  request.managerReview = { decision: payload.decision, by: user._id, at: new Date(), comment: payload.comment };

  if (payload.decision === 'APPROVED') {
    request.status = EXIT_STATUS.PENDING_HR;
    request.history.push({
      action: 'MANAGER_APPROVED',
      by: user._id,
      comment: payload.comment,
      previousStatus,
      newStatus: request.status,
    });
    await notifyRoles(['HR', 'ADMIN'], {
      title: 'Resignation awaiting HR approval',
      message: `${employee.fullName}'s resignation has been recommended by the reporting manager.`,
      type: 'HR',
      link: '/exit',
    });
  } else {
    request.status = EXIT_STATUS.REJECTED;
    request.history.push({
      action: 'MANAGER_REJECTED',
      by: user._id,
      comment: payload.comment,
      previousStatus,
      newStatus: request.status,
    });
  }
  await request.save();

  await notifyEmployee(request.employee, {
    title: `Resignation ${payload.decision.toLowerCase()} by manager`,
    message: payload.comment || `Your resignation was ${payload.decision.toLowerCase()} at the manager review stage.`,
    type: 'HR',
    link: '/exit',
  });

  await logAudit({
    req,
    actor: user,
    action: `RESIGNATION_MANAGER_${payload.decision}`,
    module: 'EXIT',
    entityType: 'ExitRequest',
    entityId: request._id,
    description: `${user.name} ${payload.decision.toLowerCase()} the resignation of ${employee.fullName}`,
    previousValue: { status: previousStatus },
    newValue: { status: request.status },
  });

  return request;
};

const hrReview = async ({ id, user, payload, req }) => {
  if (!isStaff(user)) throw ApiError.forbidden('HR approval is required');
  const request = await ExitRequest.findById(id);
  if (!request) throw ApiError.notFound('Exit request not found');
  if (request.status !== EXIT_STATUS.PENDING_HR) {
    throw ApiError.badRequest('This exit request is not awaiting HR review');
  }
  const employee = await Employee.findOne({ _id: request.employee, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');

  const previousStatus = request.status;
  request.hrReview = { decision: payload.decision, by: user._id, at: new Date(), comment: payload.comment };

  if (payload.decision === 'APPROVED') {
    const lastWorkingDay = time.startOfDay(payload.approvedLastWorkingDay || request.requestedLastWorkingDay);
    if (lastWorkingDay < request.resignationDate) throw ApiError.badRequest('Last working day cannot be before the resignation date');
    request.approvedLastWorkingDay = lastWorkingDay;
    request.status = EXIT_STATUS.APPROVED;
    employee.employmentStatus = EMPLOYMENT_STATUS.NOTICE_PERIOD;
    employee.dateOfExit = lastWorkingDay;
    await employee.save();
    request.history.push({
      action: 'HR_APPROVED',
      by: user._id,
      comment: payload.comment,
      previousStatus,
      newStatus: request.status,
    });
  } else {
    request.status = EXIT_STATUS.REJECTED;
    request.history.push({
      action: 'HR_REJECTED',
      by: user._id,
      comment: payload.comment,
      previousStatus,
      newStatus: request.status,
    });
  }
  await request.save();

  await notifyEmployee(request.employee, {
    title: `Resignation ${payload.decision.toLowerCase()} by HR`,
    message:
      payload.decision === 'APPROVED'
        ? `Your resignation is approved. Last working day: ${time.formatDate(request.approvedLastWorkingDay)}. Please complete the clearance checklist.`
        : payload.comment || 'Your resignation was rejected by HR.',
    type: 'HR',
    link: '/exit',
  });

  await logAudit({
    req,
    actor: user,
    action: `RESIGNATION_HR_${payload.decision}`,
    module: 'EXIT',
    entityType: 'ExitRequest',
    entityId: request._id,
    description: `${user.name} ${payload.decision.toLowerCase()} the resignation of ${employee.fullName}`,
    previousValue: { status: previousStatus },
    newValue: { status: request.status, approvedLastWorkingDay: request.approvedLastWorkingDay },
  });

  return request;
};

const withdraw = async ({ id, user, employee, req }) => {
  const request = await ExitRequest.findById(id);
  if (!request) throw ApiError.notFound('Exit request not found');
  if (!employee || String(request.employee) !== String(employee._id)) {
    throw ApiError.forbidden('You can only withdraw your own resignation');
  }
  if (![EXIT_STATUS.PENDING_MANAGER, EXIT_STATUS.PENDING_HR].includes(request.status)) {
    throw ApiError.badRequest('This resignation can no longer be withdrawn. Contact HR.');
  }
  const previousStatus = request.status;
  request.status = EXIT_STATUS.WITHDRAWN;
  request.history.push({ action: 'WITHDRAWN', by: user._id, previousStatus, newStatus: request.status });
  await request.save();

  await notifyRoles(['HR', 'ADMIN'], {
    title: 'Resignation withdrawn',
    message: `${employee.fullName} withdrew their resignation.`,
    type: 'HR',
    link: '/exit',
  });
  await logAudit({
    req,
    actor: user,
    action: 'RESIGNATION_WITHDRAWN',
    module: 'EXIT',
    entityType: 'ExitRequest',
    entityId: request._id,
    description: `${employee.fullName} withdrew their resignation`,
    previousValue: { status: previousStatus },
  });
  return request;
};

const updateClearance = async ({ id, user, payload, req }) => {
  if (!isStaff(user) && user.role !== 'FINANCE') throw ApiError.forbidden('Only HR, admin or finance can clear departments');
  if (user.role === 'FINANCE' && payload.department !== CLEARANCE_DEPARTMENT.FINANCE) {
    throw ApiError.forbidden('Finance can only clear the finance department');
  }
  const request = await ExitRequest.findById(id);
  if (!request) throw ApiError.notFound('Exit request not found');
  if (![EXIT_STATUS.APPROVED, EXIT_STATUS.IN_PROGRESS].includes(request.status)) {
    throw ApiError.badRequest('Clearances can only be updated after HR approval');
  }
  const clearance = request.clearances.find((item) => item.department === payload.department);
  if (!clearance) throw ApiError.notFound('Clearance department not found');

  const previous = clearance.status;
  clearance.status = payload.status;
  clearance.remarks = payload.remarks;
  clearance.clearedBy = user._id;
  clearance.clearedAt = payload.status === 'PENDING' ? undefined : new Date();

  if (request.status === EXIT_STATUS.APPROVED) request.status = EXIT_STATUS.IN_PROGRESS;
  request.history.push({
    action: 'CLEARANCE_UPDATED',
    by: user._id,
    comment: `${payload.department}: ${payload.status}${payload.remarks ? ` - ${payload.remarks}` : ''}`,
    previousStatus: previous,
    newStatus: payload.status,
  });
  await request.save();

  await logAudit({
    req,
    actor: user,
    action: 'EXIT_CLEARANCE_UPDATED',
    module: 'EXIT',
    entityType: 'ExitRequest',
    entityId: request._id,
    description: `${payload.department} clearance set to ${payload.status}`,
    previousValue: { status: previous },
    newValue: { status: payload.status, remarks: payload.remarks },
  });

  return request;
};

const updateAssetReturn = async ({ id, user, assetId, payload, req }) => {
  if (!isStaff(user)) throw ApiError.forbidden('Only HR or admin can update asset returns');
  const request = await ExitRequest.findById(id);
  if (!request) throw ApiError.notFound('Exit request not found');
  const entry = request.assets.id(assetId) || request.assets.find((item) => String(item.asset) === String(assetId));
  if (!entry) throw ApiError.notFound('Asset entry not found');

  entry.returned = payload.returned;
  entry.returnedAt = payload.returned ? new Date() : undefined;
  entry.condition = payload.condition || entry.condition;
  entry.remarks = payload.remarks;
  request.history.push({ action: 'ASSET_RETURN_UPDATED', by: user._id, note: `${entry.assetTag}: ${payload.returned ? 'returned' : 'pending'}` });

  if (payload.returned && entry.asset) {
    const asset = await CompanyAsset.findOne({ _id: entry.asset, isDeleted: false });
    if (asset && asset.status === ASSET_STATUS.ASSIGNED) {
      asset.history.push({
        action: 'RETURNED',
        employee: request.employee,
        at: new Date(),
        by: user._id,
        condition: payload.condition,
        notes: 'Returned during exit clearance',
      });
      asset.status = ASSET_STATUS.AVAILABLE;
      asset.condition = payload.condition || asset.condition;
      asset.returnCondition = payload.condition || asset.condition;
      asset.returnedAt = new Date();
      asset.assignedTo = undefined;
      asset.assignedAt = undefined;
      await asset.save();
    }
  }

  await request.save();
  await logAudit({
    req,
    actor: user,
    action: 'EXIT_ASSET_RETURN',
    module: 'EXIT',
    entityType: 'ExitRequest',
    entityId: request._id,
    description: `Asset ${entry.assetTag} marked ${payload.returned ? 'returned' : 'not returned'}`,
  });
  return request;
};

const updateInterview = async ({ id, user, payload, req }) => {
  if (!isStaff(user)) throw ApiError.forbidden('Only HR or admin can record exit interviews');
  const request = await ExitRequest.findById(id);
  if (!request) throw ApiError.notFound('Exit request not found');
  request.exitInterview = {
    ...request.exitInterview,
    ...payload,
    interviewer: payload.done ? user._id : request.exitInterview.interviewer,
  };
  if (payload.done) request.exitInterview.done = true;
  request.history.push({ action: 'EXIT_INTERVIEW_UPDATED', by: user._id, note: payload.done ? 'Interview completed' : 'Interview updated' });
  await request.save();

  await logAudit({
    req,
    actor: user,
    action: 'EXIT_INTERVIEW_UPDATED',
    module: 'EXIT',
    entityType: 'ExitRequest',
    entityId: request._id,
    description: `Exit interview updated for exit ${request._id}`,
  });
  return request;
};

const monthlyGross = (structure) => {
  if (!structure) return 0;
  const percentage = (structure.allowances || [])
    .filter((item) => item.type === 'PERCENTAGE')
    .reduce((sum, item) => sum + (structure.basic * item.amount) / 100, 0);
  const fixed = (structure.allowances || []).filter((item) => item.type !== 'PERCENTAGE').reduce((sum, item) => sum + item.amount, 0);
  return round2(structure.basic + (structure.hra || 0) + percentage + fixed);
};

const computeSettlementPreview = async (request) => {
  const year = time.yearOf(request.approvedLastWorkingDay || request.requestedLastWorkingDay);
  const settings = await getSettings();
  const [balance, structure, unpaidPayroll] = await Promise.all([
    LeaveBalance.findOne({ employee: request.employee, year }).lean(),
    SalaryStructure.findOne({ employee: request.employee, isActive: true }).sort({ effectiveFrom: -1 }).lean(),
    Payroll.find({ employee: request.employee, status: 'APPROVED' }).select('month netPay').lean(),
  ]);

  const paidTypes = new Set((settings.leaveTypes || []).filter((type) => type.isPaid).map((type) => type.code));
  const leaveDays = (balance?.balances || [])
    .filter((entry) => paidTypes.has(entry.type))
    .reduce(
      (sum, entry) => sum + Math.max(0, (entry.allocated || 0) + (entry.carriedForward || 0) - (entry.used || 0) - (entry.pending || 0)),
      0,
    );

  const gross = monthlyGross(structure);
  const dailyRate = gross ? round2(gross / 30) : 0;
  const leaveEncashmentAmount = round2(leaveDays * dailyRate);
  const pendingSalary = round2(unpaidPayroll.reduce((sum, item) => sum + (item.netPay || 0), 0));

  const noticeDays = request.noticePeriodDays || settings.noticePeriodDays || 0;
  const requiredDate = defaultLastWorkingDay(request.resignationDate, noticeDays);
  const lastDay = request.approvedLastWorkingDay || request.requestedLastWorkingDay;
  const shortfallDays = Math.max(0, time.dayjs(requiredDate).diff(time.dayjs(lastDay), 'day'));
  const noticeRecovery = round2(shortfallDays * dailyRate);

  return {
    dailyRate,
    monthlyGross: gross,
    leaveEncashmentDays: round2(leaveDays),
    leaveEncashmentAmount,
    pendingSalary,
    pendingPayrollMonths: unpaidPayroll.map((item) => item.month),
    shortfallDays,
    noticeRecovery,
    currency: settings.currency,
    existing: request.settlement,
  };
};

const saveSettlement = async ({ id, user, payload, req }) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'HR', 'FINANCE'].includes(user.role)) {
    throw ApiError.forbidden('Only HR or finance can process full and final settlement');
  }
  const request = await ExitRequest.findById(id);
  if (!request) throw ApiError.notFound('Exit request not found');
  const preview = await computeSettlementPreview(request);

  const leaveEncashmentDays = payload.leaveEncashmentDays ?? preview.leaveEncashmentDays;
  const leaveEncashmentAmount = payload.leaveEncashmentAmount ?? round2(leaveEncashmentDays * preview.dailyRate);
  const pendingSalary = payload.pendingSalary ?? preview.pendingSalary;
  const bonus = payload.bonus ?? 0;
  const otherDeductions = payload.otherDeductions ?? 0;
  const noticeRecovery = payload.noticeRecovery ?? preview.noticeRecovery;

  request.settlement = {
    leaveEncashmentDays,
    leaveEncashmentAmount,
    pendingSalary,
    bonus,
    otherDeductions,
    noticeRecovery,
    netSettlement: round2(leaveEncashmentAmount + pendingSalary + bonus - otherDeductions - noticeRecovery),
    notes: payload.notes,
    status: 'PENDING',
    computedAt: new Date(),
  };
  request.history.push({ action: 'SETTLEMENT_COMPUTED', by: user._id, note: `Net settlement ${request.settlement.netSettlement}` });
  await request.save();

  await logAudit({
    req,
    actor: user,
    action: 'EXIT_SETTLEMENT_COMPUTED',
    module: 'EXIT',
    entityType: 'ExitRequest',
    entityId: request._id,
    description: `Full and final settlement computed for exit ${request._id}`,
    newValue: request.settlement,
  });

  return { request, preview };
};

const approveSettlement = async ({ id, user, payload, req }) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(user.role)) {
    throw ApiError.forbidden('Only finance or a super admin can approve settlement');
  }
  const request = await ExitRequest.findById(id);
  if (!request) throw ApiError.notFound('Exit request not found');
  if (!request.settlement?.computedAt) throw ApiError.badRequest('Compute the settlement before approving it');

  request.settlement.status = payload.status || 'APPROVED';
  request.settlement.approvedBy = user._id;
  request.settlement.approvedAt = new Date();
  if (request.settlement.status === 'SETTLED') {
    request.settlement.settledAt = new Date();
    request.settlement.paidReference = payload.paidReference;
  }
  if (payload.notes) request.settlement.notes = payload.notes;
  request.history.push({ action: `SETTLEMENT_${request.settlement.status}`, by: user._id, note: payload.notes });
  await request.save();

  await logAudit({
    req,
    actor: user,
    action: `EXIT_SETTLEMENT_${request.settlement.status}`,
    module: 'EXIT',
    entityType: 'ExitRequest',
    entityId: request._id,
    description: `Settlement ${request.settlement.status.toLowerCase()} for exit ${request._id}`,
    newValue: { status: request.settlement.status, amount: request.settlement.netSettlement },
  });
  return request;
};

const completeExit = async ({ id, user, payload, req }) => {
  if (!isStaff(user)) throw ApiError.forbidden('Only HR or admin can complete an exit');
  const request = await ExitRequest.findById(id);
  if (!request) throw ApiError.notFound('Exit request not found');
  if (![EXIT_STATUS.APPROVED, EXIT_STATUS.IN_PROGRESS].includes(request.status)) {
    throw ApiError.badRequest('Only approved exits can be completed');
  }
  const employee = await Employee.findOne({ _id: request.employee, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');

  const pendingClearances = request.clearances.filter((item) => item.status === 'PENDING');
  if (pendingClearances.length) {
    throw ApiError.badRequest(
      `Complete all clearances first. Pending: ${pendingClearances.map((item) => item.department).join(', ')}`,
    );
  }
  const pendingAssets = request.assets.filter((item) => !item.returned);
  if (pendingAssets.length) {
    throw ApiError.badRequest(`Asset return is pending for: ${pendingAssets.map((item) => item.assetTag).join(', ')}`);
  }
  if (!request.settlement || !['APPROVED', 'SETTLED'].includes(request.settlement.status)) {
    throw ApiError.badRequest('Approve the full and final settlement before completing the exit');
  }

  const previousStatus = request.status;
  request.status = EXIT_STATUS.COMPLETED;
  request.completedAt = new Date();
  request.completedBy = user._id;
  request.history.push({
    action: 'EXIT_COMPLETED',
    by: user._id,
    comment: payload?.comment,
    previousStatus,
    newStatus: request.status,
  });
  await request.save();

  // Employee records are retained for audit and payroll history: only the status changes.
  employee.employmentStatus =
    [EXIT_TYPE.TERMINATION, EXIT_TYPE.ABSCONDING].includes(request.exitType)
      ? EMPLOYMENT_STATUS.TERMINATED
      : EMPLOYMENT_STATUS.INACTIVE;
  employee.dateOfExit = request.approvedLastWorkingDay || request.requestedLastWorkingDay;
  employee.offboarding = {
    ...(employee.offboarding || {}),
    lastWorkingDay: employee.dateOfExit,
    reason: request.reason,
    exitInterviewDone: Boolean(request.exitInterview?.done),
    assetsReturned: true,
  };
  await employee.save();

  if (employee.user) {
    const User = mongoose.model('User');
    await User.findByIdAndUpdate(employee.user, { isActive: false });
  }

  await notifyEmployee(employee._id, {
    title: 'Exit process completed',
    message: `Your exit has been completed with effect from ${time.formatDate(employee.dateOfExit)}. Your relieving and experience letters are available to download.`,
    type: 'HR',
    link: '/exit',
  });
  await notifyRoles(['HR', 'ADMIN', 'FINANCE'], {
    title: 'Employee exit completed',
    message: `${employee.fullName} (${employee.employeeId}) has been separated from the company.`,
    type: 'HR',
    link: '/exit',
  });

  await logAudit({
    req,
    actor: user,
    action: 'EXIT_COMPLETED',
    module: 'EXIT',
    entityType: 'ExitRequest',
    entityId: request._id,
    description: `${employee.fullName} exit completed`,
    previousValue: { employmentStatus: employee.employmentStatus },
    newValue: { dateOfExit: employee.dateOfExit, settlement: request.settlement?.netSettlement },
  });

  return request;
};

const buildLetterPdf = async ({ request, type, settings, employee }) => {
  const isRelieving = type === 'RELIEVING';
  const lastDay = request.approvedLastWorkingDay || request.requestedLastWorkingDay;
  const designation = employee.designation?.title || 'team member';
  const department = employee.department?.name || 'the organisation';

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 56 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(18).text(sanitize(settings.companyName || 'Company'));
      doc.fillColor('#475569').font('Helvetica').fontSize(9).text(sanitize(settings.address || ''));
      doc.moveDown(1.4);

      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13).text(isRelieving ? 'RELIEVING LETTER' : 'EXPERIENCE LETTER', { align: 'center' });
      doc.moveDown(0.8);
      doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`Date: ${time.formatDate(new Date())}`, { align: 'right' });
      doc.moveDown(0.8);

      const intro = isRelieving
        ? `This is to certify that ${employee.fullName} (Employee ID: ${employee.employeeId}) was employed with ${settings.companyName} as ${designation} in ${department} from ${time.formatDate(employee.dateOfJoining)} to ${time.formatDate(lastDay)}.`
        : `This is to certify that ${employee.fullName} (Employee ID: ${employee.employeeId}) worked with ${settings.companyName} as ${designation} in ${department} from ${time.formatDate(employee.dateOfJoining)} to ${time.formatDate(lastDay)}.`;

      doc.font('Helvetica').fontSize(11).fillColor('#0f172a').text(sanitize(intro), { align: 'justify', lineGap: 3 });
      doc.moveDown(0.8);

      const body = isRelieving
        ? `All company clearances and full and final settlement formalities have been completed to the best of our records. ${employee.firstName} is hereby relieved of all duties and responsibilities with effect from the close of business on ${time.formatDate(lastDay)}.`
        : `${employee.firstName} was found to be sincere, diligent and professional during the tenure with us. We appreciate the contribution made to the team and wish continued success in future endeavours.`;
      doc.text(sanitize(body), { align: 'justify', lineGap: 3 });
      doc.moveDown(0.8);
      doc.text(sanitize('This letter is issued on request for employment records and does not carry any financial liability on the company.'), { align: 'justify', lineGap: 3 });
      doc.moveDown(3);

      doc.font('Helvetica-Bold').fontSize(10).text('For ' + sanitize(settings.companyName || 'Company'));
      doc.moveDown(2);
      doc.font('Helvetica').fontSize(10).text('Authorised Signatory');
      doc.fontSize(9).fillColor('#64748b').text('Human Resources');

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const issueLetter = async ({ id, user, type, res, req }) => {
  const request = await ExitRequest.findById(id).populate({
    path: 'employee',
    select: 'employeeId firstName lastName dateOfJoining designation department',
    populate: [{ path: 'designation', select: 'title' }, { path: 'department', select: 'name' }],
  });
  if (!request) throw ApiError.notFound('Exit request not found');
  const owner = Boolean(user.employee) && String(request.employee?._id || request.employee) === String(user.employee);
  if (!isStaff(user) && !owner) throw ApiError.forbidden('You can only download your own exit letters');
  if (![EXIT_STATUS.IN_PROGRESS, EXIT_STATUS.COMPLETED].includes(request.status)) {
    throw ApiError.badRequest('Letters can be issued after HR approval');
  }

  const settings = await getSettings();
  const employee = request.employee;
  const buffer = await buildLetterPdf({ request, type, settings, employee });
  const stamp = type === 'RELIEVING' ? 'relievingIssuedAt' : 'experienceIssuedAt';
  request.letters = { ...(request.letters || {}), [stamp]: request.letters?.[stamp] || new Date(), issuedBy: user._id };
  request.history.push({ action: `LETTER_${type}_ISSUED`, by: user._id });
  await request.save();

  await logAudit({
    req,
    actor: user,
    action: `EXIT_LETTER_${type}`,
    module: 'EXIT',
    entityType: 'ExitRequest',
    entityId: request._id,
    description: `${type} letter issued for ${employee.fullName}`,
  });

  const safeName = `${employee.employeeId}-${type.toLowerCase()}-letter.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.send(buffer);
};

const exportExits = async ({ query, res, user }) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.exitType) filter.exitType = query.exitType;
  const settings = await getSettings();
  const requests = await ExitRequest.find(filter)
    .populate({
      path: 'employee',
      select: 'employeeId firstName lastName department designation',
      populate: [{ path: 'department', select: 'name' }, { path: 'designation', select: 'title' }],
    })
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  return sendExport(res, {
    format: query.format || 'xlsx',
    baseName: 'exit-report',
    title: `${settings.companyName} - Employee Exit Report`,
    subtitle: `Status: ${query.status || 'All'} | Type: ${query.exitType || 'All'}`,
    meta: [{ label: 'Generated by', value: user.name }],
    columns: [
      { header: 'Employee ID', key: 'employeeId', width: 14 },
      { header: 'Employee', key: 'name', width: 22 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Type', key: 'exitType', width: 14 },
      { header: 'Resignation', key: 'resignationDate', width: 14 },
      { header: 'Last Working Day', key: 'lastWorkingDay', width: 16 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Net Settlement', key: 'settlement', width: 16 },
    ],
    rows: requests.map((item) => ({
      employeeId: item.employee?.employeeId || '',
      name: item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
      department: item.employee?.department?.name || '',
      exitType: item.exitType,
      resignationDate: time.formatDate(item.resignationDate),
      lastWorkingDay: time.formatDate(item.approvedLastWorkingDay || item.requestedLastWorkingDay),
      status: item.status,
      settlement: item.settlement?.netSettlement || 0,
    })),
    summary: [
      { label: 'Total exits', value: requests.length },
      { label: 'Completed', value: requests.filter((item) => item.status === EXIT_STATUS.COMPLETED).length },
    ],
  });
};

module.exports = {
  submitResignation,
  initiateExit,
  listMine,
  listExits,
  getExit,
  managerReview,
  hrReview,
  withdraw,
  updateClearance,
  updateAssetReturn,
  updateInterview,
  computeSettlementPreview,
  saveSettlement,
  approveSettlement,
  completeExit,
  issueLetter,
  exportExits,
};
