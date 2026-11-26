const mongoose = require('mongoose');
const Attendance = require('../../models/Attendance');
const AttendanceCorrection = require('../../models/AttendanceCorrection');
const Shift = require('../../models/Shift');
const Holiday = require('../../models/Holiday');
const LeaveRequest = require('../../models/LeaveRequest');
const Employee = require('../../models/Employee');
const ApiError = require('../../utils/ApiError');
const { ATTENDANCE_STATUS, LEAVE_STATUS } = require('../../config/constants');
const { getPagination, paginatedResponse } = require('../../utils/pagination');
const { getSettings } = require('../../services/settings.service');
const { logAudit } = require('../../utils/audit');
const { notifyEmployee, notifyRoles } = require('../../services/notification.service');
const time = require('../../utils/time');
const { sendExport } = require('../../utils/exports');

const BLOCKING_LEAVE = [LEAVE_STATUS.APPROVED];

const resolveShift = async (employee) => {
  if (employee?.shift) {
    const assigned = await Shift.findOne({ _id: employee.shift, isActive: true });
    if (assigned) return assigned;
  }
  const defaultShift = await Shift.findOne({ isDefault: true, isActive: true });
  if (defaultShift) return defaultShift;
  const anyShift = await Shift.findOne({ isActive: true }).sort({ createdAt: 1 });
  if (anyShift) return anyShift;
  const settings = await getSettings();
  return {
    _id: undefined,
    startTime: settings.workStartTime,
    endTime: settings.workEndTime,
    graceMinutes: settings.gracePeriodMinutes,
    breakMinutes: 60,
    weeklyOffs: settings.workingDays,
  };
};

const attendanceDateOf = (dateStr, tz) => time.startOfDay(time.combineDateAndTime(dateStr, '00:00', tz));

const ensureEmployee = (employee) => {
  if (!employee) throw ApiError.badRequest('Your account has no employee profile. Contact HR.');
  return employee;
};

const recomputeBreaks = (attendance) => {
  attendance.breaks.forEach((item) => {
    const end = item.end || new Date();
    item.durationMinutes = time.diffMinutes(item.start, end);
  });
  attendance.breakMinutes = attendance.breaks.reduce((total, item) => total + (item.durationMinutes || 0), 0);
};

const computeMetrics = ({ attendance, shift, settings, tz }) => {
  if (!attendance.checkIn) return attendance;
  const checkInMinutes = time.timeToMinutes(
    time.dayjs(attendance.checkIn).tz(tz).format('HH:mm'),
  );
  const shiftStartMinutes = time.timeToMinutes(shift.startTime);
  const shiftEndMinutes = time.timeToMinutes(shift.endTime);
  const grace = shift.graceMinutes ?? settings.gracePeriodMinutes ?? 0;

  attendance.lateMinutes = Math.max(0, checkInMinutes - (shiftStartMinutes + grace));
  attendance.isLate = attendance.lateMinutes > 0;

  recomputeBreaks(attendance);

  if (attendance.checkOut) {
    attendance.workedMinutes = time.diffMinutes(attendance.checkIn, attendance.checkOut);
    attendance.effectiveMinutes = Math.max(0, attendance.workedMinutes - attendance.breakMinutes);
    const checkOutMinutes = time.timeToMinutes(time.dayjs(attendance.checkOut).tz(tz).format('HH:mm'));
    attendance.earlyDepartureMinutes = Math.max(0, shiftEndMinutes - grace - checkOutMinutes);
    const required = settings.fullDayMinutes || 480;
    const halfDay = settings.halfDayMinutes || Math.round(required / 2);
    attendance.overtimeMinutes = Math.max(0, attendance.effectiveMinutes - required);

    if (attendance.effectiveMinutes < halfDay) attendance.status = ATTENDANCE_STATUS.HALF_DAY;
    else if (attendance.lateMinutes > 0) attendance.status = ATTENDANCE_STATUS.LATE;
    else if (attendance.earlyDepartureMinutes > 0) attendance.status = ATTENDANCE_STATUS.EARLY_DEPARTURE;
    else attendance.status = ATTENDANCE_STATUS.PRESENT;
  } else {
    attendance.workedMinutes = time.diffMinutes(attendance.checkIn, new Date());
    attendance.effectiveMinutes = Math.max(0, attendance.workedMinutes - attendance.breakMinutes);
    attendance.overtimeMinutes = 0;
    if (attendance.status !== ATTENDANCE_STATUS.ON_LEAVE) {
      attendance.status = attendance.isLate ? ATTENDANCE_STATUS.LATE : ATTENDANCE_STATUS.PRESENT;
    }
  }
  return attendance;
};

const getActiveBreak = (attendance) => (attendance?.breaks || []).find((item) => !item.end) || null;

const loadToday = async (employeeId, tz) => {
  const key = time.dateKey(new Date(), tz);
  const attendance = await Attendance.findOne({ employee: employeeId, date: key });
  return { key, attendance };
};

const buildTodayPayload = async (employee, settings) => {
  const tz = settings.timezone;
  const { key, attendance } = await loadToday(employee._id, tz);
  const shift = await resolveShift(employee);
  if (attendance) computeMetrics({ attendance, shift, settings, tz });
  const activeBreak = attendance ? getActiveBreak(attendance) : null;
  return {
    date: key,
    attendance,
    activeBreak,
    shift: {
      id: shift._id,
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      graceMinutes: shift.graceMinutes,
      weeklyOffs: shift.weeklyOffs,
    },
    isCheckedIn: Boolean(attendance && attendance.checkIn),
    isCheckedOut: Boolean(attendance && attendance.checkOut),
    isOnBreak: Boolean(activeBreak),
    liveWorkedMinutes: attendance && attendance.checkIn ? time.diffMinutes(attendance.checkIn, new Date()) : 0,
    liveBreakMinutes: attendance ? (attendance.breaks || []).reduce((sum, item) => sum + time.diffMinutes(item.start, item.end || new Date()), 0) : 0,
  };
};

const checkIn = async ({ user, employee, req }) => {
  ensureEmployee(employee);
  const settings = await getSettings();
  const tz = settings.timezone;
  const key = time.dateKey(new Date(), tz);

  let attendance = await Attendance.findOne({ employee: employee._id, date: key });
  if (attendance && attendance.checkIn) throw ApiError.conflict('You have already checked in today');
  if (attendance && attendance.checkOut) throw ApiError.conflict('Attendance for today is already closed');

  const shift = await resolveShift(employee);
  const now = new Date();
  if (!attendance) {
    attendance = new Attendance({
      employee: employee._id,
      date: key,
      attendanceDate: attendanceDateOf(key, tz),
      events: [],
      originalEvents: [],
    });
  }
  attendance.checkIn = now;
  attendance.shift = shift._id;
  attendance.source = 'SELF';
  const event = { type: 'CHECK_IN', at: now, actor: user._id, meta: { ip: req.ip } };
  attendance.events.push(event);
  attendance.originalEvents.push(event);
  computeMetrics({ attendance, shift, settings, tz });
  await attendance.save();

  await logAudit({
    req,
    actor: user,
    action: 'ATTENDANCE_CHECK_IN',
    module: 'ATTENDANCE',
    entityType: 'Attendance',
    entityId: attendance._id,
    description: `${employee.fullName} checked in at ${time.formatTime(now)}`,
  });

  return buildTodayPayload(employee, settings);
};

const startBreak = async ({ user, employee, req, payload = {} }) => {
  ensureEmployee(employee);
  const settings = await getSettings();
  const tz = settings.timezone;
  const { attendance } = await loadToday(employee._id, tz);
  if (!attendance || !attendance.checkIn) throw ApiError.badRequest('Check in before starting a break');
  if (attendance.checkOut) throw ApiError.badRequest('You have already checked out for today');
  if (getActiveBreak(attendance)) throw ApiError.conflict('A break is already in progress');

  const now = new Date();
  attendance.breaks.push({ start: now, type: payload.type || 'LUNCH' });
  const event = { type: 'BREAK_START', at: now, actor: user._id };
  attendance.events.push(event);
  attendance.originalEvents.push(event);
  await attendance.save();

  await logAudit({
    req,
    actor: user,
    action: 'ATTENDANCE_BREAK_START',
    module: 'ATTENDANCE',
    entityType: 'Attendance',
    entityId: attendance._id,
    description: `${employee.fullName} started a break`,
  });

  return buildTodayPayload(employee, settings);
};

const endBreak = async ({ user, employee, req }) => {
  ensureEmployee(employee);
  const settings = await getSettings();
  const tz = settings.timezone;
  const { attendance } = await loadToday(employee._id, tz);
  if (!attendance) throw ApiError.badRequest('No attendance record found for today');
  const active = getActiveBreak(attendance);
  if (!active) throw ApiError.badRequest('There is no active break to end');

  const now = new Date();
  active.end = now;
  active.durationMinutes = time.diffMinutes(active.start, now);
  const event = { type: 'BREAK_END', at: now, actor: user._id, meta: { durationMinutes: active.durationMinutes } };
  attendance.events.push(event);
  attendance.originalEvents.push(event);
  const shift = await resolveShift(employee);
  computeMetrics({ attendance, shift, settings, tz });
  await attendance.save();

  await logAudit({
    req,
    actor: user,
    action: 'ATTENDANCE_BREAK_END',
    module: 'ATTENDANCE',
    entityType: 'Attendance',
    entityId: attendance._id,
    description: `${employee.fullName} ended a break after ${active.durationMinutes} minute(s)`,
  });

  return buildTodayPayload(employee, settings);
};

const checkOut = async ({ user, employee, req }) => {
  ensureEmployee(employee);
  const settings = await getSettings();
  const tz = settings.timezone;
  const { attendance } = await loadToday(employee._id, tz);
  if (!attendance || !attendance.checkIn) throw ApiError.badRequest('You have not checked in today');
  if (attendance.checkOut) throw ApiError.conflict('You have already checked out today');

  const now = new Date();
  const active = getActiveBreak(attendance);
  if (active) {
    active.end = now;
    active.durationMinutes = time.diffMinutes(active.start, now);
    attendance.events.push({ type: 'BREAK_END', at: now, actor: user._id, meta: { auto: true } });
    attendance.originalEvents.push({ type: 'BREAK_END', at: now, actor: user._id, meta: { auto: true } });
  }
  attendance.checkOut = now;
  const event = { type: 'CHECK_OUT', at: now, actor: user._id };
  attendance.events.push(event);
  attendance.originalEvents.push(event);
  const shift = await resolveShift(employee);
  computeMetrics({ attendance, shift, settings, tz });
  await attendance.save();

  await logAudit({
    req,
    actor: user,
    action: 'ATTENDANCE_CHECK_OUT',
    module: 'ATTENDANCE',
    entityType: 'Attendance',
    entityId: attendance._id,
    description: `${employee.fullName} checked out. Effective ${time.minutesToDuration(attendance.effectiveMinutes)}`,
    newValue: { status: attendance.status, effectiveMinutes: attendance.effectiveMinutes },
  });

  return buildTodayPayload(employee, settings);
};

const getToday = async (employee) => {
  ensureEmployee(employee);
  const settings = await getSettings();
  return buildTodayPayload(employee, settings);
};

const getMyAttendance = async ({ employee, query }) => {
  ensureEmployee(employee);
  const settings = await getSettings();
  const tz = settings.timezone;
  const pagination = getPagination({ ...query, limit: query.limit || 31 });
  const filter = { employee: employee._id };

  if (query.month) {
    const range = time.monthRange(query.month, tz);
    filter.date = { $gte: range.startKey, $lte: range.endKey };
  } else if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = time.dateKey(query.from, tz);
    if (query.to) filter.date.$lte = time.dateKey(query.to, tz);
  } else {
    const monthKey = time.monthKey(new Date(), tz);
    const range = time.monthRange(monthKey, tz);
    filter.date = { $gte: range.startKey, $lte: range.endKey };
  }
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    Attendance.find(filter).sort({ date: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    Attendance.countDocuments(filter),
  ]);

  const summary = items.reduce(
    (acc, item) => ({
      present: acc.present + (item.status === ATTENDANCE_STATUS.PRESENT ? 1 : 0),
      late: acc.late + (item.status === ATTENDANCE_STATUS.LATE ? 1 : 0),
      halfDay: acc.halfDay + (item.status === ATTENDANCE_STATUS.HALF_DAY ? 1 : 0),
      absent: acc.absent + (item.status === ATTENDANCE_STATUS.ABSENT ? 1 : 0),
      onLeave: acc.onLeave + (item.status === ATTENDANCE_STATUS.ON_LEAVE ? 1 : 0),
      wfh: acc.wfh + (item.status === ATTENDANCE_STATUS.WFH ? 1 : 0),
      effectiveMinutes: acc.effectiveMinutes + (item.effectiveMinutes || 0),
      overtimeMinutes: acc.overtimeMinutes + (item.overtimeMinutes || 0),
    }),
    { present: 0, late: 0, halfDay: 0, absent: 0, onLeave: 0, wfh: 0, effectiveMinutes: 0, overtimeMinutes: 0 },
  );

  return { ...paginatedResponse(items, total, pagination), summary };
};

const getMonthCalendar = async ({ employee, month, employeeId, user }) => {
  ensureEmployee(employee);
  const settings = await getSettings();
  const tz = settings.timezone;
  const canViewOthers = Boolean(user) && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(user.role);
  if (employeeId && String(employeeId) !== String(employee._id) && !canViewOthers) {
    throw ApiError.forbidden('You can only view your own attendance calendar');
  }
  const targetEmployeeId = canViewOthers && employeeId ? employeeId : employee._id;
  const range = time.monthRange(month || time.monthKey(new Date(), tz), tz);

  const [records, holidays, leaves] = await Promise.all([
    Attendance.find({ employee: targetEmployeeId, date: { $gte: range.startKey, $lte: range.endKey } }).lean(),
    Holiday.find({ date: { $gte: range.start, $lte: range.end }, isActive: true }).lean(),
    LeaveRequest.find({
      employee: targetEmployeeId,
      status: { $in: BLOCKING_LEAVE },
      startDate: { $lte: range.end },
      endDate: { $gte: range.start },
    }).lean(),
  ]);

  const recordMap = records.reduce((acc, item) => ({ ...acc, [item.date]: item }), {});
  const holidayMap = holidays.reduce(
    (acc, item) => ({ ...acc, [time.dateKey(item.date, tz)]: item.name }),
    {},
  );
  const todayKey = time.dateKey(new Date(), tz);
  const workingDays = settings.workingDays || [1, 2, 3, 4, 5];

  const days = time.listDateKeys(range.start, range.end).map((key) => {
    const record = recordMap[key];
    const holidayName = holidayMap[key];
    const onLeave = leaves.some(
      (leave) => time.dateKey(leave.startDate, tz) <= key && time.dateKey(leave.endDate, tz) >= key,
    );
    const dow = time.dayjs(key).day();
    const isWeekend = !workingDays.includes(dow);
    let status = null;
    if (record) status = record.status;
    else if (onLeave && key <= todayKey) status = ATTENDANCE_STATUS.ON_LEAVE;
    else if (holidayName) status = ATTENDANCE_STATUS.HOLIDAY;
    else if (isWeekend) status = ATTENDANCE_STATUS.WEEKLY_OFF;
    else if (key < todayKey) status = ATTENDANCE_STATUS.ABSENT;

    return {
      date: key,
      status,
      holiday: holidayName || null,
      isWeekend,
      onLeave,
      checkIn: record?.checkIn || null,
      checkOut: record?.checkOut || null,
      effectiveMinutes: record?.effectiveMinutes || 0,
      overtimeMinutes: record?.overtimeMinutes || 0,
      breakMinutes: record?.breakMinutes || 0,
      lateMinutes: record?.lateMinutes || 0,
      breaks: record?.breaks || [],
      attendanceId: record?._id || null,
      isFuture: key > todayKey,
    };
  });

  const summary = {
    present: days.filter((day) => [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE, ATTENDANCE_STATUS.EARLY_DEPARTURE, ATTENDANCE_STATUS.WFH].includes(day.status)).length,
    late: days.filter((day) => day.status === ATTENDANCE_STATUS.LATE).length,
    absent: days.filter((day) => day.status === ATTENDANCE_STATUS.ABSENT).length,
    halfDay: days.filter((day) => day.status === ATTENDANCE_STATUS.HALF_DAY).length,
    onLeave: days.filter((day) => day.status === ATTENDANCE_STATUS.ON_LEAVE).length,
    wfh: days.filter((day) => day.status === ATTENDANCE_STATUS.WFH).length,
    holidays: days.filter((day) => day.status === ATTENDANCE_STATUS.HOLIDAY).length,
    weeklyOffs: days.filter((day) => day.status === ATTENDANCE_STATUS.WEEKLY_OFF).length,
    effectiveMinutes: days.reduce((sum, day) => sum + (day.effectiveMinutes || 0), 0),
    overtimeMinutes: days.reduce((sum, day) => sum + (day.overtimeMinutes || 0), 0),
  };

  return { month: range.month, days, summary };
};

const buildOrgFilter = (query) => {
  const filter = {};
  if (query.employee && mongoose.isValidObjectId(query.employee)) filter.employee = query.employee;
  if (query.department && mongoose.isValidObjectId(query.department)) filter.department = query.department;
  if (query.status) filter.status = query.status;
  if (query.date) filter.date = query.date;
  if (query.month) {
    filter.date = { $gte: `${query.month}-01`, $lte: `${query.month}-31` };
  } else if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = time.dateKey(query.from);
    if (query.to) filter.date.$lte = time.dateKey(query.to);
  }
  return filter;
};

const listAttendance = async (query) => {
  const pagination = getPagination(query);
  const filter = buildOrgFilter(query);
  const employeeFilter = {};
  if (query.search) {
    employeeFilter.$or = [
      { firstName: { $regex: query.search, $options: 'i' } },
      { lastName: { $regex: query.search, $options: 'i' } },
      { employeeId: { $regex: query.search, $options: 'i' } },
    ];
  }
  if (query.department && mongoose.isValidObjectId(query.department)) employeeFilter.department = query.department;
  if (Object.keys(employeeFilter).length) {
    const ids = await Employee.find({ ...employeeFilter, isDeleted: false }).select('_id');
    filter.employee = { $in: ids.map((item) => item._id) };
  }

  const [items, total] = await Promise.all([
    Attendance.find(filter)
      .populate({ path: 'employee', select: 'employeeId firstName lastName department designation profilePhoto', populate: [{ path: 'department', select: 'name' }, { path: 'designation', select: 'title' }] })
      .populate('shift', 'name startTime endTime')
      .sort({ date: -1, checkIn: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean({ virtuals: true }),
    Attendance.countDocuments(filter),
  ]);
  return paginatedResponse(items, total, pagination);
};

const getOrgAttendanceSummary = async ({ date, department }) => {
  const settings = await getSettings();
  const targetDate = date || time.dateKey(new Date(), settings.timezone);
  const employeeFilter = { isDeleted: false, employmentStatus: { $in: ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD'] } };
  if (department) employeeFilter.department = department;
  const employees = await Employee.find(employeeFilter).select('_id');
  const ids = employees.map((item) => item._id);

  const [records, totalEmployees, onLeave] = await Promise.all([
    Attendance.find({ date: targetDate, employee: { $in: ids } }).lean(),
    ids.length,
    LeaveRequest.countDocuments({
      status: LEAVE_STATUS.APPROVED,
      startDate: { $lte: new Date(`${targetDate}T23:59:59`) },
      endDate: { $gte: new Date(`${targetDate}T00:00:00`) },
      employee: { $in: ids },
    }),
  ]);

  const counts = records.reduce(
    (acc, item) => {
      acc.byStatus[item.status] = (acc.byStatus[item.status] || 0) + 1;
      acc.effectiveMinutes += item.effectiveMinutes || 0;
      acc.overtimeMinutes += item.overtimeMinutes || 0;
      return acc;
    },
    { byStatus: {}, effectiveMinutes: 0, overtimeMinutes: 0 },
  );

  const present = records.filter((item) =>
    [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE, ATTENDANCE_STATUS.EARLY_DEPARTURE, ATTENDANCE_STATUS.HALF_DAY, ATTENDANCE_STATUS.WFH].includes(item.status),
  ).length;

  return {
    date: targetDate,
    totalEmployees,
    present,
    late: records.filter((item) => item.status === ATTENDANCE_STATUS.LATE).length,
    absent: Math.max(0, totalEmployees - present - onLeave),
    onLeave,
    notMarked: Math.max(0, totalEmployees - records.length - onLeave),
    byStatus: counts.byStatus,
    effectiveMinutes: counts.effectiveMinutes,
    overtimeMinutes: counts.overtimeMinutes,
  };
};

const requestCorrection = async ({ user, employee, payload, req }) => {
  ensureEmployee(employee);
  const settings = await getSettings();
  const tz = settings.timezone;
  const key = payload.date ? time.dateKey(payload.date, tz) : time.dateKey(new Date(), tz);

  const windowDays = settings.attendanceCorrectionWindowDays || 7;
  const daysAgo = time.dayjs(time.dateKey(new Date(), tz)).diff(time.dayjs(key), 'day');
  if (daysAgo < 0) throw ApiError.badRequest('You cannot request a correction for a future date');
  if (daysAgo > windowDays) {
    throw ApiError.badRequest(`Correction requests are limited to the last ${windowDays} day(s). Contact HR.`);
  }

  const existing = await AttendanceCorrection.findOne({
    employee: employee._id,
    date: key,
    status: 'PENDING',
  });
  if (existing) throw ApiError.conflict('A pending correction request already exists for this date');

  if (!payload.requestedCheckIn && !payload.requestedCheckOut && !payload.requestedStatus) {
    throw ApiError.badRequest('Provide at least one correction value');
  }
  if (payload.requestedCheckIn && payload.requestedCheckOut) {
    if (new Date(payload.requestedCheckOut) <= new Date(payload.requestedCheckIn)) {
      throw ApiError.badRequest('Check-out time must be after check-in time');
    }
  }

  const attendance = await Attendance.findOne({ employee: employee._id, date: key });
  const correction = await AttendanceCorrection.create({
    employee: employee._id,
    attendance: attendance?._id,
    date: key,
    requestedCheckIn: payload.requestedCheckIn,
    requestedCheckOut: payload.requestedCheckOut,
    requestedStatus: payload.requestedStatus,
    reason: payload.reason,
    originalSnapshot: attendance
      ? {
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          status: attendance.status,
          breaks: attendance.breaks,
        }
      : null,
  });

  await notifyRoles(['HR', 'ADMIN'], {
    title: 'New attendance correction request',
    message: `${employee.fullName} (${employee.employeeId}) requested a correction for ${key}.`,
    type: 'ATTENDANCE',
    link: '/attendance/corrections',
  });

  await logAudit({
    req,
    actor: user,
    action: 'ATTENDANCE_CORRECTION_REQUESTED',
    module: 'ATTENDANCE',
    entityType: 'AttendanceCorrection',
    entityId: correction._id,
    description: `${employee.fullName} requested attendance correction for ${key}`,
    newValue: payload,
  });

  await notifyEmployee(employee._id, {
    title: 'Correction request submitted',
    message: `Your attendance correction request for ${key} has been submitted for review.`,
    type: 'ATTENDANCE',
    link: '/attendance/corrections',
  });

  return correction;
};

const listCorrections = async ({ query, user }) => {
  const pagination = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.employee) filter.employee = query.employee;
  if (['EMPLOYEE', 'FINANCE'].includes(user.role) && user.employee) filter.employee = user.employee;
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = time.dateKey(query.from);
    if (query.to) filter.date.$lte = time.dateKey(query.to);
  }

  const [items, total] = await Promise.all([
    AttendanceCorrection.find(filter)
      .populate({ path: 'employee', select: 'employeeId firstName lastName department', populate: { path: 'department', select: 'name' } })
      .populate({ path: 'reviewedBy', select: 'name role' })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    AttendanceCorrection.countDocuments(filter),
  ]);
  return paginatedResponse(items, total, pagination);
};

const reviewCorrection = async ({ id, user, payload, req }) => {
  const correction = await AttendanceCorrection.findById(id);
  if (!correction) throw ApiError.notFound('Correction request not found');
  if (correction.status !== 'PENDING') throw ApiError.badRequest('This correction request has already been reviewed');

  const employee = await Employee.findById(correction.employee);
  if (!employee) throw ApiError.notFound('Employee not found');

  const settings = await getSettings();
  const tz = settings.timezone;

  if (payload.status === 'APPROVED') {
    let attendance = await Attendance.findOne({ employee: correction.employee, date: correction.date });
    if (!attendance) {
      attendance = new Attendance({
        employee: correction.employee,
        date: correction.date,
        attendanceDate: attendanceDateOf(correction.date, tz),
        source: 'CORRECTION',
        events: [],
        originalEvents: [],
      });
    }
    const originalSnapshot = attendance.originalEvents?.length
      ? attendance.originalEvents
      : [...(attendance.events || [])];

    if (correction.requestedCheckIn) attendance.checkIn = correction.requestedCheckIn;
    if (correction.requestedCheckOut) attendance.checkOut = correction.requestedCheckOut;
    if (correction.requestedStatus) attendance.status = correction.requestedStatus;

    const shift = await resolveShift(employee);
    computeMetrics({ attendance, shift, settings, tz });
    if (correction.requestedStatus) attendance.status = correction.requestedStatus;

    attendance.source = 'CORRECTION';
    attendance.correction = correction._id;
    attendance.updatedBy = user._id;
    attendance.originalEvents = originalSnapshot;
    attendance.events.push({
      type: 'CORRECTION_APPLIED',
      at: new Date(),
      actor: user._id,
      meta: { correction: correction._id, requestedBy: correction.employee },
    });
    await attendance.save();
    correction.appliedAttendance = attendance._id;
  }

  correction.status = payload.status;
  correction.reviewedBy = user._id;
  correction.reviewedAt = new Date();
  correction.reviewComment = payload.reviewComment;
  await correction.save();

  await notifyEmployee(correction.employee, {
    title: `Attendance correction ${payload.status.toLowerCase()}`,
    message: `Your correction request for ${correction.date} was ${payload.status.toLowerCase()}.${
      payload.reviewComment ? ` Comment: ${payload.reviewComment}` : ''
    }`,
    type: 'ATTENDANCE',
    link: '/attendance/corrections',
  });

  await logAudit({
    req,
    actor: user,
    action: `ATTENDANCE_CORRECTION_${payload.status}`,
    module: 'ATTENDANCE',
    entityType: 'AttendanceCorrection',
    entityId: correction._id,
    description: `${user.name} ${payload.status.toLowerCase()} attendance correction for ${employee.fullName} on ${correction.date}`,
    newValue: { status: payload.status, comment: payload.reviewComment },
  });

  return correction;
};

const correctAttendance = async ({ id, user, payload, req }) => {
  const attendance = await Attendance.findById(id);
  if (!attendance) throw ApiError.notFound('Attendance record not found');
  const previous = attendance.toObject();

  if (payload.checkIn !== undefined) attendance.checkIn = payload.checkIn;
  if (payload.checkOut !== undefined) attendance.checkOut = payload.checkOut;
  if (payload.notes !== undefined) attendance.notes = payload.notes;

  const employee = await Employee.findById(attendance.employee);
  const settings = await getSettings();
  const shift = await resolveShift(employee);
  computeMetrics({ attendance, shift, settings, tz: settings.timezone });
  if (payload.status) attendance.status = payload.status;
  attendance.source = 'ADMIN';
  attendance.updatedBy = user._id;
  attendance.events.push({
    type: 'MANUAL_OVERRIDE',
    at: new Date(),
    actor: user._id,
    meta: { notes: payload.notes },
  });
  await attendance.save();

  await logAudit({
    req,
    actor: user,
    action: 'ATTENDANCE_MANUAL_OVERRIDE',
    module: 'ATTENDANCE',
    entityType: 'Attendance',
    entityId: attendance._id,
    description: `${user.name} manually corrected attendance for ${employee?.fullName || attendance.employee} on ${attendance.date}`,
    previousValue: { checkIn: previous.checkIn, checkOut: previous.checkOut, status: previous.status },
    newValue: { checkIn: attendance.checkIn, checkOut: attendance.checkOut, status: attendance.status },
  });

  return attendance;
};

const exportAttendance = async ({ query, res, user }) => {
  const filter = buildOrgFilter(query);
  if (['EMPLOYEE', 'FINANCE'].includes(user.role) && user.employee) {
    filter.employee = user.employee;
  }
  const records = await Attendance.find(filter)
    .populate({ path: 'employee', select: 'employeeId firstName lastName department', populate: { path: 'department', select: 'name' } })
    .sort({ date: -1 })
    .limit(5000)
    .lean();

  const settings = await getSettings();
  const rows = records.map((item) => ({
    employeeId: item.employee?.employeeId || '',
    name: item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
    department: item.employee?.department?.name || '',
    date: item.date,
    checkIn: time.formatTime(item.checkIn),
    checkOut: time.formatTime(item.checkOut),
    breaks: item.breaks?.length || 0,
    breakDuration: time.minutesToDuration(item.breakMinutes),
    worked: time.minutesToDuration(item.workedMinutes),
    effective: time.minutesToDuration(item.effectiveMinutes),
    overtime: time.minutesToDuration(item.overtimeMinutes),
    lateMinutes: item.lateMinutes || 0,
    status: item.status,
  }));

  const columns = [
    { header: 'Employee ID', key: 'employeeId', width: 16 },
    { header: 'Employee', key: 'name', width: 24 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Check In', key: 'checkIn', width: 12 },
    { header: 'Check Out', key: 'checkOut', width: 12 },
    { header: 'Breaks', key: 'breaks', width: 8 },
    { header: 'Break Duration', key: 'breakDuration', width: 14 },
    { header: 'Worked', key: 'worked', width: 12 },
    { header: 'Effective', key: 'effective', width: 12 },
    { header: 'Overtime', key: 'overtime', width: 12 },
    { header: 'Late (min)', key: 'lateMinutes', width: 10 },
    { header: 'Status', key: 'status', width: 16 },
  ];

  return sendExport(res, {
    format: query.format || 'xlsx',
    baseName: 'attendance-report',
    title: `${settings.companyName} - Attendance Report`,
    subtitle: `Period: ${query.from || query.month || 'All records'} to ${query.to || ''}`,
    meta: [{ label: 'Generated by', value: user.name }, { label: 'Records', value: rows.length }],
    columns,
    rows,
    summary: [
      { label: 'Total records', value: rows.length },
      {
        label: 'Total effective hours',
        value: time.minutesToDuration(records.reduce((sum, item) => sum + (item.effectiveMinutes || 0), 0)),
      },
      {
        label: 'Total overtime hours',
        value: time.minutesToDuration(records.reduce((sum, item) => sum + (item.overtimeMinutes || 0), 0)),
      },
    ],
  });
};

/** Used by the WFH module to mark an approved day as worked from home. */
const markWfhDay = async (employeeId, dateStr) =>
  markLeaveDay(employeeId, dateStr, ATTENDANCE_STATUS.WFH);

/** Used by the leave module to mark a day as leave. */
const markLeaveDay = async (employeeId, dateStr, status = ATTENDANCE_STATUS.ON_LEAVE) => {
  const settings = await getSettings();
  const tz = settings.timezone;
  const existing = await Attendance.findOne({ employee: employeeId, date: dateStr });
  if (existing && existing.checkIn) return existing;
  if (existing) {
    existing.status = status;
    await existing.save();
    return existing;
  }
  return Attendance.create({
    employee: employeeId,
    date: dateStr,
    attendanceDate: attendanceDateOf(dateStr, tz),
    status,
    source: 'SYSTEM',
    events: [{ type: 'SYSTEM_MARK', at: new Date(), meta: { status } }],
    originalEvents: [{ type: 'SYSTEM_MARK', at: new Date(), meta: { status } }],
  });
};

module.exports = {
  checkIn,
  startBreak,
  endBreak,
  checkOut,
  getToday,
  getMyAttendance,
  getMonthCalendar,
  listAttendance,
  getOrgAttendanceSummary,
  requestCorrection,
  listCorrections,
  reviewCorrection,
  correctAttendance,
  exportAttendance,
  markLeaveDay,
  markWfhDay,
  buildTodayPayload,
  resolveShift,
};
