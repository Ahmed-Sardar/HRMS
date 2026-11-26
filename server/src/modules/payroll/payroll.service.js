const mongoose = require('mongoose');
const Payroll = require('../../models/Payroll');
const Payslip = require('../../models/Payslip');
const SalaryStructure = require('../../models/SalaryStructure');
const Reimbursement = require('../../models/Reimbursement');
const Attendance = require('../../models/Attendance');
const LeaveRequest = require('../../models/LeaveRequest');
const Holiday = require('../../models/Holiday');
const Employee = require('../../models/Employee');
const ApiError = require('../../utils/ApiError');
const { ATTENDANCE_STATUS, LEAVE_STATUS, PAYROLL_STATUS, REIMBURSEMENT_STATUS } = require('../../config/constants');
const { getPagination, paginatedResponse } = require('../../utils/pagination');
const { getSettings } = require('../../services/settings.service');
const { logAudit } = require('../../utils/audit');
const { notifyEmployee, notifyRoles } = require('../../services/notification.service');
const { sendExport } = require('../../utils/exports');
const { toStoredFile, deleteStoredFile } = require('../../middleware/upload');
const time = require('../../utils/time');
const { computeStatutory, buildStatutoryDeductionLines } = require('../../utils/statutory');

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const getActiveStructure = async (employeeId, monthEnd) => {
  return SalaryStructure.findOne({
    employee: employeeId,
    isActive: true,
    effectiveFrom: { $lte: monthEnd },
    $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gte: monthEnd } }],
  }).sort({ effectiveFrom: -1 });
};

const structureTotals = (structure) => {
  const percentageAllowances = (structure.allowances || [])
    .filter((item) => item.type === 'PERCENTAGE')
    .reduce((sum, item) => sum + (structure.basic * item.amount) / 100, 0);
  const fixedAllowances = (structure.allowances || [])
    .filter((item) => item.type !== 'PERCENTAGE')
    .reduce((sum, item) => sum + item.amount, 0);
  const grossMonthly = structure.basic + (structure.hra || 0) + percentageAllowances + fixedAllowances;
  const fixedDeductions = (structure.deductions || []).reduce((sum, item) => sum + item.amount, 0);
  return { grossMonthly: round2(grossMonthly), fixedDeductions: round2(fixedDeductions) };
};

const getMonthWorkingDays = async (month, settings) => {
  const range = time.monthRange(month, settings.timezone);
  const holidays = await Holiday.find({
    date: { $gte: range.start, $lte: range.end },
    isActive: true,
    isOptional: false,
  }).lean();
  return time.countWorkingDays({
    startDate: range.start,
    endDate: range.end,
    workingDays: settings.workingDays || [1, 2, 3, 4, 5],
    holidayKeys: holidays.map((item) => time.dateKey(item.date, settings.timezone)),
  });
};

// ---------------- Salary structures ----------------
const listStructures = async (query) => {
  const pagination = getPagination(query);
  const filter = {};
  if (query.employee) filter.employee = query.employee;
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (query.department) {
    const ids = await Employee.find({ department: query.department, isDeleted: false }).select('_id');
    filter.employee = { $in: ids.map((item) => item._id) };
  }
  const [items, total] = await Promise.all([
    SalaryStructure.find(filter)
      .populate({ path: 'employee', select: 'employeeId firstName lastName department designation', populate: [{ path: 'department', select: 'name' }, { path: 'designation', select: 'title' }] })
      .sort({ effectiveFrom: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean({ virtuals: true }),
    SalaryStructure.countDocuments(filter),
  ]);
  return paginatedResponse(items, total, pagination);
};

const createStructure = async ({ payload, user, req }) => {
  const employee = await Employee.findOne({ _id: payload.employee, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');

  const previous = await SalaryStructure.find({ employee: payload.employee, isActive: true });
  await SalaryStructure.updateMany(
    { employee: payload.employee, isActive: true },
    { isActive: false, effectiveTo: new Date(payload.effectiveFrom) },
  );

  const structure = await SalaryStructure.create({ ...payload, isActive: true, createdBy: user._id });

  await notifyEmployee(employee._id, {
    title: 'Salary structure updated',
    message: 'A new salary structure has been applied to your profile. You can view your payslips under Payroll.',
    type: 'PAYROLL',
    link: '/payroll/my',
  });

  await logAudit({
    req,
    actor: user,
    action: 'SALARY_STRUCTURE_CREATED',
    module: 'PAYROLL',
    entityType: 'SalaryStructure',
    entityId: structure._id,
    description: `Created salary structure for ${employee.fullName} effective ${time.formatDate(structure.effectiveFrom)}`,
    previousValue: previous.length ? { previousStructures: previous.length } : undefined,
    newValue: { basic: structure.basic, hra: structure.hra, allowances: structure.allowances },
  });
  return structure;
};

const updateStructure = async ({ id, payload, user, req }) => {
  const structure = await SalaryStructure.findById(id);
  if (!structure) throw ApiError.notFound('Salary structure not found');
  const previous = structure.toObject();
  Object.assign(structure, payload);
  structure.updatedBy = user._id;
  await structure.save();
  await logAudit({
    req,
    actor: user,
    action: 'SALARY_STRUCTURE_UPDATED',
    module: 'PAYROLL',
    entityType: 'SalaryStructure',
    entityId: structure._id,
    description: `Updated salary structure ${structure._id}`,
    previousValue: { basic: previous.basic, hra: previous.hra, allowances: previous.allowances },
    newValue: { basic: structure.basic, hra: structure.hra, allowances: structure.allowances },
  });
  return structure;
};

const deleteStructure = async ({ id, user, req }) => {
  const structure = await SalaryStructure.findById(id);
  if (!structure) throw ApiError.notFound('Salary structure not found');
  structure.isActive = false;
  structure.effectiveTo = new Date();
  await structure.save();
  await logAudit({
    req,
    actor: user,
    action: 'SALARY_STRUCTURE_DEACTIVATED',
    module: 'PAYROLL',
    entityType: 'SalaryStructure',
    entityId: structure._id,
    description: `Deactivated salary structure ${structure._id}`,
  });
  return { success: true };
};

// ---------------- Payroll run ----------------
const calculateEmployeePayroll = async ({ employee, month, settings, workingDays }) => {
  const structure = await getActiveStructure(employee._id, time.monthRange(month, settings.timezone).end);
  if (!structure) return null;

  const range = time.monthRange(month, settings.timezone);
  const [attendance, leaves] = await Promise.all([
    Attendance.find({ employee: employee._id, date: { $gte: range.startKey, $lte: range.endKey } }).lean(),
    LeaveRequest.find({
      employee: employee._id,
      status: LEAVE_STATUS.APPROVED,
      startDate: { $lte: range.end },
      endDate: { $gte: range.start },
    }).lean(),
  ]);

  const attendanceSummary = attendance.reduce(
    (acc, item) => {
      if (item.status === ATTENDANCE_STATUS.HALF_DAY) {
        acc.presentUnits += 0.5;
        acc.halfDays += 1;
      } else if (
        [
          ATTENDANCE_STATUS.PRESENT,
          ATTENDANCE_STATUS.LATE,
          ATTENDANCE_STATUS.EARLY_DEPARTURE,
          ATTENDANCE_STATUS.WFH,
        ].includes(item.status)
      ) {
        acc.presentUnits += 1;
        if (item.status === ATTENDANCE_STATUS.LATE) acc.late += 1;
      }
      acc.overtimeMinutes += item.overtimeMinutes || 0;
      return acc;
    },
    { presentUnits: 0, halfDays: 0, late: 0, overtimeMinutes: 0 },
  );

  const paidTypes = new Set((settings.leaveTypes || []).filter((type) => type.isPaid).map((type) => type.code));
  const holidayKeys = new Set(
    (await Holiday.find({ date: { $gte: range.start, $lte: range.end }, isActive: true, isOptional: false }).lean()).map((item) =>
      time.dateKey(item.date, settings.timezone),
    ),
  );

  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  leaves.forEach((leave) => {
    if (leave.isHalfDay) {
      if (paidTypes.has(leave.leaveType)) paidLeaveDays += 0.5;
      else unpaidLeaveDays += 0.5;
      return;
    }
    const start = leave.startDate < range.start ? range.start : leave.startDate;
    const end = leave.endDate > range.end ? range.end : leave.endDate;
    time.listDateKeys(start, end).forEach((key) => {
      const dow = time.dayjs(key).day();
      if (!(settings.workingDays || [1, 2, 3, 4, 5]).includes(dow) || holidayKeys.has(key)) return;
      if (paidTypes.has(leave.leaveType)) paidLeaveDays += 1;
      else unpaidLeaveDays += 1;
    });
  });

  const payableUnits = Math.min(workingDays, attendanceSummary.presentUnits + paidLeaveDays);
  const lopDays = round2(Math.max(0, workingDays - payableUnits));
  const { grossMonthly, fixedDeductions } = structureTotals(structure);
  const perDay = workingDays > 0 ? grossMonthly / workingDays : 0;
  const lopAmount = round2(perDay * lopDays);

  const overtimeRatePerHour =
    structure.overtimeEligible && workingDays > 0
      ? grossMonthly / (workingDays * ((settings.fullDayMinutes || 480) / 60))
      : 0;
  const overtimeAmount = round2(
    (attendanceSummary.overtimeMinutes / 60) * overtimeRatePerHour * (settings.overtimeMultiplier || 1.5),
  );

  const reimbursements = await Reimbursement.find({
    employee: employee._id,
    status: REIMBURSEMENT_STATUS.APPROVED,
    $or: [{ payrollMonth: month }, { payrollMonth: { $in: [null, ''] }, expenseDate: { $gte: range.start, $lte: range.end } }],
  });
  const reimbursementAmount = round2(reimbursements.reduce((sum, item) => sum + item.amount, 0));

  const allowanceLines = (structure.allowances || []).map((item) => ({
    name: item.name,
    amount: round2(item.type === 'PERCENTAGE' ? (structure.basic * item.amount) / 100 : item.amount),
  }));

  // Statutory deductions are opt-in per company and come entirely from settings.
  const statutory = computeStatutory({ basic: structure.basic, grossMonthly, settings });

  const deductionLines = (structure.deductions || []).map((item) => ({
    name: item.name,
    amount: round2(item.amount),
  }));
  if (lopAmount > 0) deductionLines.push({ name: `Loss of Pay (${lopDays} day(s))`, amount: lopAmount });
  buildStatutoryDeductionLines(statutory).forEach((line) => deductionLines.push(line));

  const grossEarnings = round2(grossMonthly + overtimeAmount + reimbursementAmount);
  const totalDeductions = round2(fixedDeductions + lopAmount + statutory.employeeTotal);
  const netPay = round2(Math.max(0, grossEarnings - totalDeductions));

  return {
    structure,
    payroll: {
      employee: employee._id,
      month,
      year: Number(month.split('-')[0]),
      salaryStructure: structure._id,
      currency: structure.currency || settings.currency,
      basic: round2(structure.basic),
      hra: round2(structure.hra || 0),
      allowances: allowanceLines,
      deductions: deductionLines,
      grossEarnings,
      totalDeductions,
      overtimeMinutes: attendanceSummary.overtimeMinutes,
      overtimeAmount,
      reimbursementAmount,
      lopDays,
      lopAmount,
      statutory: {
        pfEmployee: statutory.pfEmployee,
        pfEmployer: statutory.pfEmployer,
        esiEmployee: statutory.esiEmployee,
        esiEmployer: statutory.esiEmployer,
        professionalTax: statutory.professionalTax,
        tds: statutory.tds,
        employeeTotal: statutory.employeeTotal,
        employerTotal: statutory.employerTotal,
      },
      netPay,
      workingDays,
      paidDays: round2(payableUnits),
      presentDays: round2(attendanceSummary.presentUnits),
      leaveDays: round2(paidLeaveDays),
      status: PAYROLL_STATUS.DRAFT,
      processedBy: undefined,
    },
    reimbursements,
    unpaidLeaveDays,
  };
};

const runPayroll = async ({ payload, user, req }) => {
  const settings = await getSettings();
  const month = payload.month || time.monthKey(new Date(), settings.timezone);
  if (!/^\d{4}-\d{2}$/.test(month)) throw ApiError.badRequest('Month must be in YYYY-MM format');

  const workingDays = await getMonthWorkingDays(month, settings);
  if (workingDays === 0) throw ApiError.badRequest('No working days found for the selected month');

  const employeeFilter = { isDeleted: false, employmentStatus: { $in: ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD'] } };
  if (payload.department) employeeFilter.department = payload.department;
  if (payload.employeeIds?.length) employeeFilter._id = { $in: payload.employeeIds };
  const employees = await Employee.find(employeeFilter).select('_id employeeId firstName lastName');

  const existing = await Payroll.find({ month }).select('employee status');
  const lockedEmployees = new Set(
    existing.filter((item) => item.status !== PAYROLL_STATUS.DRAFT).map((item) => String(item.employee)),
  );

  const results = { created: 0, updated: 0, skipped: 0, noStructure: 0, errors: [] };

  for (const employee of employees) {
    if (lockedEmployees.has(String(employee._id))) {
      results.skipped += 1;
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const calculated = await calculateEmployeePayroll({ employee, month, settings, workingDays });
      if (!calculated) {
        results.noStructure += 1;
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const existingRecord = await Payroll.findOne({ employee: employee._id, month });
      const payloadData = {
        ...calculated.payroll,
        processedBy: user._id,
        bonus: existingRecord?.bonus || payload.bonus || 0,
        notes: payload.notes || existingRecord?.notes,
      };
      payloadData.netPay = round2(
        Math.max(0, payloadData.grossEarnings + (payloadData.bonus || 0) - payloadData.totalDeductions),
      );

      if (existingRecord) {
        existingRecord.set(payloadData);
        // eslint-disable-next-line no-await-in-loop
        await existingRecord.save();
        results.updated += 1;
      } else {
        // eslint-disable-next-line no-await-in-loop
        await Payroll.create(payloadData);
        results.created += 1;
      }
    } catch (error) {
      results.errors.push({ employee: employee.employeeId, message: error.message });
    }
  }

  await logAudit({
    req,
    actor: user,
    action: 'PAYROLL_RUN',
    module: 'PAYROLL',
    entityType: 'Payroll',
    description: `Processed payroll for ${month}: ${results.created} created, ${results.updated} updated, ${results.noStructure} without salary structure`,
    newValue: results,
  });

  return { month, workingDays, ...results, totalEmployees: employees.length };
};

const listPayroll = async (query) => {
  const pagination = getPagination(query);
  const filter = {};
  if (query.month) filter.month = query.month;
  if (query.status) filter.status = query.status;
  if (query.employee) filter.employee = query.employee;
  if (query.department) {
    const ids = await Employee.find({ department: query.department }).select('_id');
    filter.employee = { $in: ids.map((item) => item._id) };
  }
  if (query.search) {
    const ids = await Employee.find({
      $or: [
        { firstName: { $regex: query.search, $options: 'i' } },
        { lastName: { $regex: query.search, $options: 'i' } },
        { employeeId: { $regex: query.search, $options: 'i' } },
      ],
    }).select('_id');
    filter.employee = { $in: ids.map((item) => item._id) };
  }

  const [items, total] = await Promise.all([
    Payroll.find(filter)
      .populate({ path: 'employee', select: 'employeeId firstName lastName department designation bankDetails', populate: [{ path: 'department', select: 'name' }, { path: 'designation', select: 'title' }] })
      .populate('approvedBy', 'name')
      .sort({ month: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Payroll.countDocuments(filter),
  ]);

  const totals = await Payroll.aggregate([
    { $match: filter },
    { $group: { _id: '$status', net: { $sum: '$netPay' }, gross: { $sum: '$grossEarnings' }, count: { $sum: 1 } } },
  ]);

  return {
    ...paginatedResponse(items, total, pagination),
    totals: totals.reduce((acc, item) => ({ ...acc, [item._id]: item }), {}),
  };
};

const createPayslipSnapshot = async ({ payroll, user }) => {
  const existing = await Payslip.findOne({ payroll: payroll._id });
  if (existing) return existing;
  const employee = await Employee.findById(payroll.employee)
    .populate('department', 'name')
    .populate('designation', 'title')
    .lean();
  return Payslip.create({
    payroll: payroll._id,
    employee: payroll.employee,
    month: payroll.month,
    number: `PS-${payroll.month.replace('-', '')}-${employee?.employeeId || String(payroll.employee).slice(-6)}`,
    snapshot: {
      employee: {
        employeeId: employee?.employeeId,
        name: employee ? `${employee.firstName} ${employee.lastName}` : '',
        email: employee?.email,
        department: employee?.department?.name,
        designation: employee?.designation?.title,
        dateOfJoining: employee?.dateOfJoining,
      },
      payroll: payroll.toObject(),
      generatedBy: user?.name,
    },
    generatedBy: user?._id,
  });
};

const approvePayroll = async ({ id, user, req }) => {
  const payroll = await Payroll.findById(id);
  if (!payroll) throw ApiError.notFound('Payroll record not found');
  if (payroll.status === PAYROLL_STATUS.PAID) throw ApiError.badRequest('This payroll has already been paid');
  if (payroll.status === PAYROLL_STATUS.DRAFT && payroll.workingDays === 0) {
    throw ApiError.badRequest('Re-run payroll before approving: working days are missing');
  }

  const previousStatus = payroll.status;
  payroll.status = PAYROLL_STATUS.APPROVED;
  payroll.approvedBy = user._id;
  payroll.approvedAt = new Date();
  await payroll.save();
  const payslip = await createPayslipSnapshot({ payroll, user });

  await notifyEmployee(payroll.employee, {
    title: 'Payslip available',
    message: `Your payslip for ${payroll.month} is now available. Net pay: ${payroll.netPay}.`,
    type: 'PAYROLL',
    link: '/payroll/my',
  });

  await logAudit({
    req,
    actor: user,
    action: 'PAYROLL_APPROVED',
    module: 'PAYROLL',
    entityType: 'Payroll',
    entityId: payroll._id,
    description: `Approved payroll for ${payroll.month} (net ${payroll.netPay})`,
    previousValue: { status: previousStatus },
    newValue: { status: payroll.status, payslip: payslip.number },
  });

  return { payroll, payslip };
};

const approvePayrollMonth = async ({ month, user, req }) => {
  const drafts = await Payroll.find({ month, status: PAYROLL_STATUS.DRAFT });
  const slips = [];
  for (const payroll of drafts) {
    // eslint-disable-next-line no-await-in-loop
    payroll.status = PAYROLL_STATUS.APPROVED;
    payroll.approvedBy = user._id;
    payroll.approvedAt = new Date();
    // eslint-disable-next-line no-await-in-loop
    await payroll.save();
    // eslint-disable-next-line no-await-in-loop
    slips.push(await createPayslipSnapshot({ payroll, user }));
    // eslint-disable-next-line no-await-in-loop
    await notifyEmployee(payroll.employee, {
      title: 'Payslip available',
      message: `Your payslip for ${payroll.month} is now available.`,
      type: 'PAYROLL',
      link: '/payroll/my',
    });
  }
  await logAudit({
    req,
    actor: user,
    action: 'PAYROLL_MONTH_APPROVED',
    module: 'PAYROLL',
    entityType: 'Payroll',
    description: `Approved ${drafts.length} payroll record(s) for ${month}`,
  });
  return { approved: drafts.length, payslips: slips.length };
};

const markPaid = async ({ id, user, payload, req }) => {
  const payroll = await Payroll.findById(id);
  if (!payroll) throw ApiError.notFound('Payroll record not found');
  if (payroll.status !== PAYROLL_STATUS.APPROVED) {
    throw ApiError.badRequest('Only approved payroll records can be marked as paid');
  }
  payroll.status = PAYROLL_STATUS.PAID;
  payroll.paidAt = new Date();
  payroll.paymentReference = payload.paymentReference;
  await payroll.save();

  await notifyEmployee(payroll.employee, {
    title: 'Salary credited',
    message: `Your salary for ${payroll.month} has been marked as paid. Net amount: ${payroll.netPay}.`,
    type: 'PAYROLL',
    link: '/payroll/my',
  });

  await logAudit({
    req,
    actor: user,
    action: 'PAYROLL_PAID',
    module: 'PAYROLL',
    entityType: 'Payroll',
    entityId: payroll._id,
    description: `Marked payroll for ${payroll.month} as paid`,
    newValue: { reference: payload.paymentReference },
  });
  return payroll;
};

const getPayroll = async ({ id, user }) => {
  const payroll = await Payroll.findById(id)
    .populate({ path: 'employee', select: 'employeeId firstName lastName department designation email', populate: [{ path: 'department', select: 'name' }, { path: 'designation', select: 'title' }] })
    .lean();
  if (!payroll) throw ApiError.notFound('Payroll record not found');
  if (user.role === 'EMPLOYEE' && String(payroll.employee?._id) !== String(user.employee)) {
    throw ApiError.forbidden('You can only view your own payroll records');
  }
  const payslip = await Payslip.findOne({ payroll: payroll._id }).lean();
  return { payroll, payslip };
};

const getMyPayslips = async ({ user, query }) => {
  if (!user.employee) throw ApiError.unauthorized();
  const pagination = getPagination(query);
  const filter = { employee: user.employee, status: { $in: [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID] } };
  if (query.month) filter.month = query.month;
  const [items, total] = await Promise.all([
    Payroll.find(filter).sort({ month: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    Payroll.countDocuments(filter),
  ]);
  const slips = await Payslip.find({ payroll: { $in: items.map((item) => item._id) } }).select('payroll number generatedAt').lean();
  const slipMap = slips.reduce((acc, item) => ({ ...acc, [String(item.payroll)]: item }), {});
  return {
    ...paginatedResponse(
      items.map((item) => ({ ...item, payslip: slipMap[String(item._id)] || null })),
      total,
      pagination,
    ),
  };
};

const payslipPdf = async ({ id, user, res, req }) => {
  const payroll = await Payroll.findById(id)
    .populate({ path: 'employee', select: 'employeeId firstName lastName email department designation bankDetails dateOfJoining', populate: [{ path: 'department', select: 'name' }, { path: 'designation', select: 'title' }] })
    .lean();
  if (!payroll) throw ApiError.notFound('Payroll record not found');
  const isOwner = user.employee && String(payroll.employee?._id) === String(user.employee);
  if (!isOwner && !['FINANCE', 'SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    throw ApiError.forbidden('You are not allowed to download this payslip');
  }
  if (![PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID].includes(payroll.status)) {
    throw ApiError.badRequest('Payslip is available once payroll is approved');
  }
  const settings = await getSettings();

  const earnings = [
    { component: 'Basic Salary', type: 'Earning', amount: payroll.basic },
    { component: 'House Rent Allowance', type: 'Earning', amount: payroll.hra },
    ...(payroll.allowances || []).map((item) => ({ component: item.name, type: 'Earning', amount: item.amount })),
    { component: 'Overtime', type: 'Earning', amount: payroll.overtimeAmount },
    { component: 'Reimbursements', type: 'Earning', amount: payroll.reimbursementAmount },
    { component: 'Bonus', type: 'Earning', amount: payroll.bonus || 0 },
    ...(payroll.deductions || []).map((item) => ({ component: item.name, type: 'Deduction', amount: item.amount })),
  ].filter((item) => item.amount);

  await logAudit({
    req,
    actor: user,
    action: 'PAYSLIP_DOWNLOADED',
    module: 'PAYROLL',
    entityType: 'Payroll',
    entityId: payroll._id,
    description: `Payslip downloaded for ${payroll.month}`,
  });

  return sendExport(res, {
    format: 'pdf',
    baseName: `payslip-${payroll.employee.employeeId}-${payroll.month}`,
    title: `${settings.companyName} - Payslip`,
    subtitle: `Pay period: ${payroll.month}`,
    meta: [
      { label: 'Employee', value: `${payroll.employee.firstName} ${payroll.employee.lastName} (${payroll.employee.employeeId})` },
      { label: 'Department', value: payroll.employee.department?.name || '-' },
      { label: 'Designation', value: payroll.employee.designation?.title || '-' },
      { label: 'Payment status', value: payroll.status },
      {
        label: 'Bank account',
        value: payroll.employee.bankDetails?.accountNumber
          ? `****${String(payroll.employee.bankDetails.accountNumber).slice(-4)} (${payroll.employee.bankDetails.bankName || 'Bank'})`
          : 'Not on record',
      },
      { label: 'Working days', value: payroll.workingDays },
      { label: 'Paid days', value: payroll.paidDays },
    ],
    columns: [
      { header: 'Component', key: 'component', width: 50 },
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Amount', key: 'amount', width: 30 },
    ],
    rows: earnings,
    summary: [
      { label: 'Gross earnings', value: payroll.grossEarnings },
      { label: 'Total deductions', value: payroll.totalDeductions },
      { label: 'Net pay', value: `${settings.currency} ${payroll.netPay}` },
      { label: 'Loss of pay days', value: payroll.lopDays },
      ...(payroll.statutory?.employerTotal
        ? [
            { label: 'Employer PF + ESI (cost to company)', value: payroll.statutory.employerTotal },
          ]
        : []),
    ],
  });
};

const exportPayroll = async ({ query, res, user, req }) => {
  const filter = {};
  if (query.month) filter.month = query.month;
  if (query.status) filter.status = query.status;
  const records = await Payroll.find(filter)
    .populate({ path: 'employee', select: 'employeeId firstName lastName department', populate: { path: 'department', select: 'name' } })
    .sort({ month: -1 })
    .limit(5000)
    .lean();
  const settings = await getSettings();

  const rows = records.map((item) => ({
    employeeId: item.employee?.employeeId || '',
    name: item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
    department: item.employee?.department?.name || '',
    month: item.month,
    workingDays: item.workingDays,
    paidDays: item.paidDays,
    basic: item.basic,
    hra: item.hra,
    allowances: (item.allowances || []).reduce((sum, line) => sum + line.amount, 0),
    pf: item.statutory?.pfEmployee || 0,
    esi: item.statutory?.esiEmployee || 0,
    professionalTax: item.statutory?.professionalTax || 0,
    tds: item.statutory?.tds || 0,
    overtime: item.overtimeAmount,
    reimbursements: item.reimbursementAmount,
    gross: item.grossEarnings,
    deductions: item.totalDeductions,
    lopDays: item.lopDays,
    net: item.netPay,
    status: item.status,
  }));

  await logAudit({
    req,
    actor: user,
    action: 'PAYROLL_EXPORTED',
    module: 'PAYROLL',
    description: `Exported payroll data (${rows.length} records)`,
  });

  return sendExport(res, {
    format: query.format || 'xlsx',
    baseName: `payroll-${query.month || 'all'}`,
    title: `${settings.companyName} - Payroll Register`,
    subtitle: query.month ? `Month: ${query.month}` : 'All months',
    meta: [{ label: 'Generated by', value: user.name }],
    columns: [
      { header: 'Employee ID', key: 'employeeId', width: 14 },
      { header: 'Employee', key: 'name', width: 22 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Month', key: 'month', width: 10 },
      { header: 'Work Days', key: 'workingDays', width: 10 },
      { header: 'Paid Days', key: 'paidDays', width: 10 },
      { header: 'Basic', key: 'basic', width: 12 },
      { header: 'HRA', key: 'hra', width: 10 },
      { header: 'Allowances', key: 'allowances', width: 12 },
      { header: 'PF', key: 'pf', width: 10 },
      { header: 'ESI', key: 'esi', width: 10 },
      { header: 'PT', key: 'professionalTax', width: 10 },
      { header: 'TDS', key: 'tds', width: 10 },
      { header: 'Overtime', key: 'overtime', width: 12 },
      { header: 'Reimbursements', key: 'reimbursements', width: 14 },
      { header: 'Gross', key: 'gross', width: 12 },
      { header: 'Deductions', key: 'deductions', width: 12 },
      { header: 'LOP Days', key: 'lopDays', width: 10 },
      { header: 'Net Pay', key: 'net', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
    ],
    rows,
    summary: [
      { label: 'Records', value: rows.length },
      { label: 'Total gross', value: rows.reduce((sum, row) => sum + row.gross, 0) },
      { label: 'Total deductions', value: rows.reduce((sum, row) => sum + row.deductions, 0) },
      { label: 'Total net', value: rows.reduce((sum, row) => sum + row.net, 0) },
    ],
  });
};

// ---------------- Reimbursements (employee side) ----------------
const createReimbursement = async ({ user, employee, payload, file, req }) => {
  if (!employee) throw ApiError.badRequest('Your account has no employee profile. Contact HR.');
  const reimbursement = await Reimbursement.create({
    employee: employee._id,
    title: payload.title,
    category: payload.category || 'OTHER',
    amount: payload.amount,
    expenseDate: payload.expenseDate,
    description: payload.description,
    receipt: file ? toStoredFile(file, 'documents') : undefined,
  });

  await notifyRoles(['FINANCE', 'SUPER_ADMIN'], {
    title: 'New reimbursement request',
    message: `${employee.fullName} submitted a ${payload.category} reimbursement of ${payload.amount}.`,
    type: 'FINANCE',
    link: '/finance/reimbursements',
  });

  await logAudit({
    req,
    actor: user,
    action: 'REIMBURSEMENT_CREATED',
    module: 'REIMBURSEMENT',
    entityType: 'Reimbursement',
    entityId: reimbursement._id,
    description: `Reimbursement '${reimbursement.title}' submitted for ${reimbursement.amount}`,
  });

  return reimbursement;
};

const listMyReimbursements = async ({ user, query }) => {
  if (!user.employee) throw ApiError.unauthorized();
  const pagination = getPagination(query);
  const filter = { employee: user.employee };
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    Reimbursement.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    Reimbursement.countDocuments(filter),
  ]);
  return paginatedResponse(items, total, pagination);
};

const cancelReimbursement = async ({ id, user, req }) => {
  const reimbursement = await Reimbursement.findById(id);
  if (!reimbursement) throw ApiError.notFound('Reimbursement not found');
  if (!user.employee || String(reimbursement.employee) !== String(user.employee)) {
    throw ApiError.forbidden('You can only cancel your own reimbursement requests');
  }
  if (reimbursement.status !== REIMBURSEMENT_STATUS.PENDING) {
    throw ApiError.badRequest('Only pending reimbursements can be cancelled');
  }
  await Reimbursement.deleteOne({ _id: reimbursement._id });
  if (reimbursement.receipt?.path) deleteStoredFile(reimbursement.receipt.path);
  await logAudit({
    req,
    actor: user,
    action: 'REIMBURSEMENT_CANCELLED',
    module: 'REIMBURSEMENT',
    entityType: 'Reimbursement',
    entityId: reimbursement._id,
    description: `Reimbursement '${reimbursement.title}' cancelled`,
  });
  return { success: true };
};

module.exports = {
  calculateEmployeePayroll,
  listStructures,
  createStructure,
  updateStructure,
  deleteStructure,
  runPayroll,
  listPayroll,
  approvePayroll,
  approvePayrollMonth,
  markPaid,
  getPayroll,
  getMyPayslips,
  payslipPdf,
  exportPayroll,
  createReimbursement,
  listMyReimbursements,
  cancelReimbursement,
};
