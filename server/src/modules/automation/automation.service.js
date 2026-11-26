const Employee = require('../../models/Employee');
const Attendance = require('../../models/Attendance');
const LeaveRequest = require('../../models/LeaveRequest');
const LeaveBalance = require('../../models/LeaveBalance');
const WfhRequest = require('../../models/WfhRequest');
const AttendanceCorrection = require('../../models/AttendanceCorrection');
const EmployeeDocument = require('../../models/EmployeeDocument');
const Holiday = require('../../models/Holiday');
const Notification = require('../../models/Notification');
const AutomationRun = require('../../models/AutomationRun');
const { getSettings } = require('../../services/settings.service');
const { notifyEmployee, notifyRoles } = require('../../services/notification.service');
const time = require('../../utils/time');

const JOBS = Object.freeze({
  REMINDERS: 'reminders',
  LEAVE_ACCRUAL: 'leave-accrual',
  AUTO_ABSENT: 'auto-absent',
});

const ACTIVE_EMPLOYEE_FILTER = {
  isDeleted: false,
  employmentStatus: { $in: ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD'] },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const startOfLocalDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

/** Whole days from `now` until `date` (negative when the date has passed). */
const daysUntil = (date, now = new Date()) =>
  Math.round((startOfLocalDay(date).getTime() - startOfLocalDay(now).getTime()) / DAY_MS);

/** True when `date` falls between today and today + days (inclusive). */
const isWithinDays = (date, days, now = new Date()) => {
  if (!date) return false;
  const diff = daysUntil(date, now);
  return diff >= 0 && diff <= days;
};

/** Decides whether a scheduled job is due again. */
const isDue = ({ lastRunAt, now = new Date(), intervalMs }) =>
  !lastRunAt || new Date(now).getTime() - new Date(lastRunAt).getTime() >= intervalMs;

/** Completed years between two dates. */
const completedYears = (from, to = new Date()) => {
  if (!from) return 0;
  const start = time.dayjs(from).startOf('day');
  const end = time.dayjs(to).startOf('day');
  if (end.isBefore(start)) return 0;
  return end.diff(start, 'year');
};

/** "MM-DD" of a date in the company timezone, or null. */
const monthDayKey = (date, timezone) => (date ? String(time.dateKey(date, timezone)).slice(5) : null);

/**
 * Works out how much of last year's unused balance each leave type carries into
 * the new year. A maxCarryForward of 0 is treated as "no cap".
 */
const planCarryForward = ({ previousBalances = [], leaveTypes = [] }) =>
  leaveTypes.map((type) => {
    const entry = previousBalances.find((item) => item.type === type.code);
    const available = Math.max(
      0,
      Number(entry?.allocated || 0) +
        Number(entry?.carriedForward || 0) -
        Number(entry?.used || 0) -
        Number(entry?.pending || 0),
    );
    const cap = Number(type.maxCarryForward || 0);
    const carry = type.carryForward ? (cap > 0 ? Math.min(available, cap) : available) : 0;
    return {
      type: type.code,
      allocated: Number(type.annualQuota || 0),
      carriedForward: round2(carry),
    };
  });

const recordRun = async ({ job, status = 'SUCCESS', summary, error }) => {
  const existing = await AutomationRun.findOne({ job });
  await AutomationRun.findOneAndUpdate(
    { job },
    {
      job,
      lastRunAt: new Date(),
      lastStatus: status,
      lastSummary: summary,
      lastError: error ? String(error).slice(0, 500) : undefined,
      $inc: { runCount: 1 },
    },
    { upsert: true },
  );
  return existing;
};

/** Creates a notification only if the same logical reminder was not sent before. */
const notifyOnce = async ({ dedupeKey, users, roles, employee, ...payload }) => {
  if (dedupeKey) {
    const exists = await Notification.exists({ 'meta.dedupeKey': dedupeKey });
    if (exists) return 0;
  }
  const meta = { ...(payload.meta || {}), dedupeKey };
  const body = { ...payload, meta };
  if (employee) {
    const created = await notifyEmployee(employee, body);
    return created.length;
  }
  if (roles && roles.length) {
    const created = await notifyRoles(roles, body);
    return created.length;
  }
  return 0;
};

/**
 * Initialises (or repairs) every active employee's leave balance for a year and
 * carries forward unused days for types that allow it. Safe to run repeatedly:
 * usage is preserved and already-correct balances are left untouched.
 */
const initializeLeaveBalances = async ({ year, dryRun = false } = {}) => {
  const settings = await getSettings();
  const targetYear = Number(year) || time.yearOf();
  const employees = await Employee.find(ACTIVE_EMPLOYEE_FILTER)
    .select('_id employeeId firstName lastName')
    .lean();
  const employeeIds = employees.map((item) => item._id);
  const previous = await LeaveBalance.find({ year: targetYear - 1, employee: { $in: employeeIds } }).lean();
  const previousByEmployee = new Map(previous.map((item) => [String(item.employee), item]));

  const result = {
    year: targetYear,
    employees: employees.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    carriedForwardDays: 0,
    dryRun,
  };

  for (const employee of employees) {
    const plan = planCarryForward({
      previousBalances: previousByEmployee.get(String(employee._id))?.balances || [],
      leaveTypes: settings.leaveTypes || [],
    });
    const carryTotal = plan.reduce((sum, item) => sum + item.carriedForward, 0);
    // eslint-disable-next-line no-await-in-loop
    const existing = await LeaveBalance.findOne({ employee: employee._id, year: targetYear });

    if (!existing) {
      result.created += 1;
      result.carriedForwardDays += carryTotal;
      if (!dryRun) {
        // eslint-disable-next-line no-await-in-loop
        await LeaveBalance.create({
          employee: employee._id,
          year: targetYear,
          balances: plan.map((item) => ({
            type: item.type,
            allocated: item.allocated,
            used: 0,
            pending: 0,
            carriedForward: item.carriedForward,
          })),
        });
      }
      continue;
    }

    let changed = false;
    plan.forEach((item) => {
      const entry = existing.balances.find((balance) => balance.type === item.type);
      if (!entry) {
        existing.balances.push({
          type: item.type,
          allocated: item.allocated,
          used: 0,
          pending: 0,
          carriedForward: item.carriedForward,
        });
        changed = true;
        return;
      }
      if (Number(entry.allocated) !== item.allocated) {
        entry.allocated = item.allocated;
        changed = true;
      }
      if (Number(entry.carriedForward) !== item.carriedForward) {
        entry.carriedForward = item.carriedForward;
        changed = true;
      }
    });

    if (changed) {
      result.updated += 1;
      result.carriedForwardDays += carryTotal;
      if (!dryRun) {
        // eslint-disable-next-line no-await-in-loop
        await existing.save();
      }
    } else {
      result.unchanged += 1;
    }
  }

  result.carriedForwardDays = round2(result.carriedForwardDays);
  if (!dryRun) await recordRun({ job: JOBS.LEAVE_ACCRUAL, summary: result });
  return result;
};

/**
 * Sends the daily reminder set exactly once per recipient per event. In-app
 * notifications are always created; email delivery follows the existing
 * Settings → email notification switch.
 */
const runReminders = async ({ now = new Date() } = {}) => {
  const settings = await getSettings();
  const timezone = settings.timezone || 'Asia/Kolkata';
  const todayKey = time.dateKey(now, timezone);
  const todayMonthDay = todayKey.slice(5);

  const employees = await Employee.find(ACTIVE_EMPLOYEE_FILTER)
    .select('_id user employeeId firstName lastName dateOfBirth dateOfJoining confirmationDate employmentStatus')
    .lean();

  const result = { date: todayKey, created: 0, skipped: 0, byType: {} };
  const add = (type, count) => {
    if (!count) return;
    result.created += count;
    result.byType[type] = (result.byType[type] || 0) + count;
  };

  for (const employee of employees) {
    const name = `${employee.firstName} ${employee.lastName}`.trim();

    if (monthDayKey(employee.dateOfBirth, timezone) === todayMonthDay && employee.user) {
      // eslint-disable-next-line no-await-in-loop
      add(
        'birthday',
        await notifyOnce({
          dedupeKey: `birthday:${employee._id}:${todayKey}`,
          employee: employee._id,
          title: 'Happy birthday!',
          message: `The whole team wishes you a wonderful birthday, ${employee.firstName}.`,
          type: 'HR',
          link: '/dashboard',
        }),
      );
    }

    const years = completedYears(employee.dateOfJoining, now);
    if (years >= 1 && monthDayKey(employee.dateOfJoining, timezone) === todayMonthDay) {
      // eslint-disable-next-line no-await-in-loop
      add(
        'anniversary',
        await notifyOnce({
          dedupeKey: `anniversary:${employee._id}:${todayKey}`,
          employee: employee._id,
          title: `${years} year${years > 1 ? 's' : ''} with us`,
          message: `Congratulations on completing ${years} year${years > 1 ? 's' : ''} at ${settings.companyName}. Thank you for your contribution.`,
          type: 'HR',
          link: '/dashboard',
        }),
      );
      // eslint-disable-next-line no-await-in-loop
      add(
        'anniversary',
        await notifyOnce({
          dedupeKey: `anniversary-hr:${employee._id}:${todayKey}`,
          roles: ['HR'],
          title: `Work anniversary today: ${name}`,
          message: `${name} (${employee.employeeId}) completes ${years} year${years > 1 ? 's' : ''} today.`,
          type: 'HR',
          link: `/employees/${employee._id}`,
        }),
      );
    }

    if (employee.employmentStatus === 'PROBATION' && isWithinDays(employee.confirmationDate, 7, now)) {
      // eslint-disable-next-line no-await-in-loop
      add(
        'probation',
        await notifyOnce({
          dedupeKey: `probation:${employee._id}:${time.dateKey(employee.confirmationDate, timezone)}`,
          roles: ['HR'],
          title: 'Probation confirmation due',
          message: `${name} (${employee.employeeId}) is due for confirmation on ${time.formatDate(employee.confirmationDate)}.`,
          type: 'HR',
          link: `/employees/${employee._id}`,
        }),
      );
    }
  }

  const documents = await EmployeeDocument.find({
    isDeleted: false,
    expiryDate: { $gte: startOfLocalDay(now), $lte: new Date(startOfLocalDay(now).getTime() + 30 * DAY_MS) },
  })
    .populate({ path: 'employee', select: 'firstName lastName employeeId user' })
    .lean();

  for (const document of documents) {
    if (!document.employee) continue;
    const days = daysUntil(document.expiryDate, now);
    const expiryKey = time.dateKey(document.expiryDate, timezone);
    const name = `${document.employee.firstName} ${document.employee.lastName}`.trim();
    // eslint-disable-next-line no-await-in-loop
    add(
      'documentExpiry',
      await notifyOnce({
        dedupeKey: `document:${document._id}:${expiryKey}`,
        employee: document.employee._id,
        title: 'Document expiring soon',
        message: `Your document "${document.title}" expires in ${days} day${days === 1 ? '' : 's'}. Upload a renewed copy to stay compliant.`,
        type: 'DOCUMENT',
        link: '/documents',
      }),
    );
    // eslint-disable-next-line no-await-in-loop
    add(
      'documentExpiry',
      await notifyOnce({
        dedupeKey: `document-hr:${document._id}:${expiryKey}`,
        roles: ['HR'],
        title: `Document expiring: ${name}`,
        message: `"${document.title}" for ${name} expires on ${time.formatDate(document.expiryDate)}.`,
        type: 'DOCUMENT',
        link: '/documents',
      }),
    );
  }

  const [pendingLeave, pendingWfh, pendingCorrections] = await Promise.all([
    LeaveRequest.countDocuments({ status: 'PENDING' }),
    WfhRequest.countDocuments({ status: 'PENDING' }),
    AttendanceCorrection.countDocuments({ status: 'PENDING' }),
  ]);
  const pendingTotal = pendingLeave + pendingWfh + pendingCorrections;
  if (pendingTotal > 0) {
    add(
      'pendingApprovals',
      await notifyOnce({
        dedupeKey: `pending-digest:${todayKey}`,
        roles: ['HR'],
        title: 'Pending approvals for today',
        message: `${pendingLeave} leave, ${pendingWfh} work-from-home and ${pendingCorrections} attendance correction request(s) are waiting for action.`,
        type: 'HR',
        link: '/leave/approvals',
      }),
    );
  }

  await recordRun({ job: JOBS.REMINDERS, summary: result });
  return result;
};

/**
 * Marks employees without attendance, approved leave or approved work-from-home
 * as absent for a past working day. Never marks today or a future date.
 */
const markAutoAbsent = async ({ date, dryRun = false } = {}) => {
  const settings = await getSettings();
  const timezone = settings.timezone || 'Asia/Kolkata';
  const target = date ? new Date(date) : time.addDays(new Date(), -1);
  const key = time.dateKey(target, timezone);
  const todayKey = time.dateKey(new Date(), timezone);

  if (key >= todayKey) {
    return { date: key, workingDay: false, marked: 0, wouldMark: 0, skipped: 0, reason: 'Only past days can be auto-marked' };
  }
  const dow = time.dayjs(key).day();
  if (!(settings.workingDays || [1, 2, 3, 4, 5]).includes(dow)) {
    return { date: key, workingDay: false, marked: 0, wouldMark: 0, skipped: 0, reason: 'Weekly off' };
  }

  const dayStart = time.startOfDay(target);
  const dayEnd = time.endOfDay(target);
  const holiday = await Holiday.findOne({
    date: { $gte: dayStart, $lte: dayEnd },
    isActive: true,
    isOptional: false,
  }).lean();
  if (holiday) {
    return { date: key, workingDay: false, marked: 0, wouldMark: 0, skipped: 0, reason: `Holiday: ${holiday.name}` };
  }

  const employees = await Employee.find({
    ...ACTIVE_EMPLOYEE_FILTER,
    dateOfJoining: { $lte: dayEnd },
    $or: [{ dateOfExit: null }, { dateOfExit: { $exists: false } }, { dateOfExit: { $gte: dayStart } }],
  })
    .select('_id')
    .lean();
  const employeeIds = employees.map((item) => item._id);

  const [attendance, leaves, wfh] = await Promise.all([
    Attendance.find({ employee: { $in: employeeIds }, date: key }).select('employee').lean(),
    LeaveRequest.find({
      employee: { $in: employeeIds },
      status: 'APPROVED',
      startDate: { $lte: dayEnd },
      endDate: { $gte: dayStart },
    })
      .select('employee')
      .lean(),
    WfhRequest.find({
      employee: { $in: employeeIds },
      status: 'APPROVED',
      startDate: { $lte: dayEnd },
      endDate: { $gte: dayStart },
    })
      .select('employee')
      .lean(),
  ]);

  const accountedFor = new Set([
    ...attendance.map((item) => String(item.employee)),
    ...leaves.map((item) => String(item.employee)),
    ...wfh.map((item) => String(item.employee)),
  ]);

  const missing = employees.filter((item) => !accountedFor.has(String(item._id)));

  if (!dryRun && missing.length) {
    await Attendance.insertMany(
      missing.map((item) => ({
        employee: item._id,
        date: key,
        attendanceDate: dayStart,
        status: 'ABSENT',
        source: 'SYSTEM',
        notes: 'Auto-marked: no attendance, approved leave or approved work-from-home for the day',
        events: [{ type: 'SYSTEM_MARK', at: new Date(), meta: { job: JOBS.AUTO_ABSENT } }],
      })),
      { ordered: false },
    );
  }

  const result = {
    date: key,
    workingDay: true,
    employees: employees.length,
    marked: dryRun ? 0 : missing.length,
    wouldMark: missing.length,
    skipped: accountedFor.size,
    dryRun,
  };
  if (!dryRun) await recordRun({ job: JOBS.AUTO_ABSENT, summary: result });
  return result;
};

const getAutomationStatus = async () => {
  const [runs, settings] = await Promise.all([AutomationRun.find({}).lean(), getSettings()]);
  const runMap = new Map(runs.map((item) => [item.job, item]));
  const jobMeta = [
    {
      job: JOBS.REMINDERS,
      label: 'Daily reminders',
      description: 'Birthdays, work anniversaries, probation confirmation, document expiry and a pending-approvals digest.',
      cadence: 'Every 24 hours',
    },
    {
      job: JOBS.LEAVE_ACCRUAL,
      label: 'Leave balance initialisation',
      description: 'Creates the yearly leave balance for every active employee and carries forward unused days where the leave type allows it.',
      cadence: 'Once per leave year',
    },
    {
      job: JOBS.AUTO_ABSENT,
      label: 'Auto-absent marking',
      description: 'Marks past working days without attendance, approved leave or approved work-from-home as absent.',
      cadence: 'Every 24 hours',
    },
  ].map((item) => ({ ...item, lastRunAt: runMap.get(item.job)?.lastRunAt || null, lastStatus: runMap.get(item.job)?.lastStatus || null, lastSummary: runMap.get(item.job)?.lastSummary || null, lastError: runMap.get(item.job)?.lastError || null, runCount: runMap.get(item.job)?.runCount || 0 }));

  return {
    schedulerEnabled: String(process.env.DISABLE_AUTOMATION || '').toLowerCase() !== 'true',
    autoAbsentScheduled: String(process.env.ENABLE_AUTO_ABSENT || '').toLowerCase() === 'true',
    timezone: settings.timezone,
    emailNotifications: Boolean(settings.enableEmailNotifications),
    jobs: jobMeta,
  };
};

/** Runs every job once; used by the scheduler and the admin "Run all" action. */
const runAllJobs = async () => {
  const reminders = await runReminders();
  const accrual = await initializeLeaveBalances({ year: time.yearOf() });
  const autoAbsent = await markAutoAbsent();
  return { reminders, accrual, autoAbsent };
};

module.exports = {
  JOBS,
  daysUntil,
  isWithinDays,
  isDue,
  completedYears,
  planCarryForward,
  initializeLeaveBalances,
  runReminders,
  markAutoAbsent,
  getAutomationStatus,
  runAllJobs,
};
