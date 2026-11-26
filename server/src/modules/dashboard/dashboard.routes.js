const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { protect } = require('../../middleware/auth');
const { ROLES, REPORT_STATUS, LEAVE_STATUS, ATTENDANCE_STATUS } = require('../../config/constants');
const Employee = require('../../models/Employee');
const Department = require('../../models/Department');
const User = require('../../models/User');
const Attendance = require('../../models/Attendance');
const LeaveRequest = require('../../models/LeaveRequest');
const LeaveBalance = require('../../models/LeaveBalance');
const PerformanceReport = require('../../models/PerformanceReport');
const Payroll = require('../../models/Payroll');
const Payslip = require('../../models/Payslip');
const Reimbursement = require('../../models/Reimbursement');
const Notification = require('../../models/Notification');
const Announcement = require('../../models/Announcement');
const AuditLog = require('../../models/AuditLog');
const CompanyAsset = require('../../models/CompanyAsset');
const WfhRequest = require('../../models/WfhRequest');
const Ticket = require('../../models/Ticket');
const ExitRequest = require('../../models/ExitRequest');
const Holiday = require('../../models/Holiday');
const { getSettings } = require('../../services/settings.service');
const { buildTodayPayload } = require('../attendance/attendance.service');
const { getMonthCalendar } = require('../attendance/attendance.service');
const time = require('../../utils/time');

const router = express.Router();
router.use(protect);

const activeEmployeeFilter = {
  isDeleted: false,
  employmentStatus: { $in: ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD'] },
};

const PRESENT_STATUSES = [
  ATTENDANCE_STATUS.PRESENT,
  ATTENDANCE_STATUS.LATE,
  ATTENDANCE_STATUS.EARLY_DEPARTURE,
  ATTENDANCE_STATUS.HALF_DAY,
];

/**
 * Shared "company pulse" used by every dashboard: today's attendance split,
 * pending approval queues, celebrations and upcoming holidays. All values are
 * queried from the database so the UI never renders sample figures.
 */
const buildPulse = async (settings) => {
  const todayKey = time.dateKey(new Date(), settings.timezone);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const [todayRecords, totalActive, pendingLeaves, pendingWfh, openTickets, activeExits, pendingReports, holidayDocs, people] =
    await Promise.all([
      Attendance.find({ date: todayKey }).select('status').lean(),
      Employee.countDocuments(activeEmployeeFilter),
      LeaveRequest.countDocuments({ status: LEAVE_STATUS.PENDING }),
      WfhRequest.countDocuments({ status: { $in: ['PENDING', 'MANAGER_APPROVED'] } }),
      Ticket.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_ON_EMPLOYEE'] } }),
      ExitRequest.countDocuments({ status: { $in: ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'IN_PROGRESS'] } }),
      PerformanceReport.countDocuments({
        status: {
          $in: [
            REPORT_STATUS.SUBMITTED,
            REPORT_STATUS.UNDER_FINANCE_REVIEW,
            REPORT_STATUS.FORWARDED_TO_HR,
            REPORT_STATUS.UNDER_HR_REVIEW,
          ],
        },
      }),
      Holiday.find({ isActive: true, date: { $gte: time.startOfDay(new Date()) } })
        .sort({ date: 1 })
        .limit(3)
        .select('name date type')
        .lean(),
      Employee.find(activeEmployeeFilter)
        .select('firstName lastName employeeId dateOfBirth dateOfJoining department')
        .populate('department', 'name')
        .lean(),
    ]);

  const countStatus = (statuses) => todayRecords.filter((record) => statuses.includes(record.status)).length;
  const present = countStatus(PRESENT_STATUSES);
  const wfh = countStatus([ATTENDANCE_STATUS.WFH]);
  const onLeave = countStatus([ATTENDANCE_STATUS.ON_LEAVE]);
  const absent = countStatus([ATTENDANCE_STATUS.ABSENT]);
  const marked = todayRecords.length;

  const birthdays = people
    .filter((person) => person.dateOfBirth && new Date(person.dateOfBirth).getMonth() === currentMonth)
    .map((person) => ({
      _id: person._id,
      name: `${person.firstName} ${person.lastName}`.trim(),
      employeeId: person.employeeId,
      department: person.department?.name || null,
      date: person.dateOfBirth,
      day: new Date(person.dateOfBirth).getDate(),
      isToday: new Date(person.dateOfBirth).getDate() === new Date().getDate(),
    }))
    .sort((a, b) => a.day - b.day)
    .slice(0, 6);

  const anniversaries = people
    .filter((person) => person.dateOfJoining && new Date(person.dateOfJoining).getMonth() === currentMonth)
    .map((person) => {
      const joined = new Date(person.dateOfJoining);
      return {
        _id: person._id,
        name: `${person.firstName} ${person.lastName}`.trim(),
        employeeId: person.employeeId,
        department: person.department?.name || null,
        date: person.dateOfJoining,
        day: joined.getDate(),
        years: currentYear - joined.getFullYear(),
      };
    })
    .filter((person) => person.years >= 1)
    .sort((a, b) => a.day - b.day)
    .slice(0, 6);

  const holidays = holidayDocs.map((holiday) => ({
    _id: holiday._id,
    name: holiday.name,
    date: holiday.date,
    type: holiday.type,
    daysAway: Math.max(0, Math.ceil((new Date(holiday.date) - time.startOfDay(new Date())) / 86400000)),
  }));

  const pending = {
    leaves: pendingLeaves,
    wfh: pendingWfh,
    tickets: openTickets,
    exits: activeExits,
    reports: pendingReports,
  };

  return {
    attendance: {
      present,
      wfh,
      onLeave,
      absent,
      notMarked: Math.max(0, totalActive - marked),
      total: totalActive,
      rate: totalActive ? Math.round(((present + wfh) / totalActive) * 100) : 0,
    },
    pending: { ...pending, total: Object.values(pending).reduce((sum, value) => sum + value, 0) },
    birthdays,
    anniversaries,
    holidays,
  };
};

const superAdminDashboard = async (req) => {
  const settings = await getSettings();
  const month = time.monthKey(new Date(), settings.timezone);
  const today = time.dateKey(new Date(), settings.timezone);
  const [
    totalEmployees,
    activeEmployees,
    departments,
    todayRecords,
    pendingLeaves,
    pendingFinance,
    pendingHr,
    payrollAgg,
    recentAudit,
    usersByRole,
    newJoiners,
    assets,
    openReports,
  ] = await Promise.all([
    Employee.countDocuments({ isDeleted: false }),
    Employee.countDocuments(activeEmployeeFilter),
    Department.countDocuments({ isActive: true }),
    Attendance.find({ date: today }).select('status').lean(),
    LeaveRequest.countDocuments({ status: LEAVE_STATUS.PENDING }),
    PerformanceReport.countDocuments({ status: { $in: [REPORT_STATUS.SUBMITTED, REPORT_STATUS.UNDER_FINANCE_REVIEW] } }),
    PerformanceReport.countDocuments({ status: { $in: [REPORT_STATUS.FORWARDED_TO_HR, REPORT_STATUS.UNDER_HR_REVIEW] } }),
    Payroll.aggregate([{ $match: { month } }, { $group: { _id: null, net: { $sum: '$netPay' }, count: { $sum: 1 } } }]),
    AuditLog.find({}).sort({ createdAt: -1 }).limit(8).lean(),
    User.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$role', count: { $sum: 1 } } }]),
    Employee.countDocuments({ isDeleted: false, dateOfJoining: { $gte: time.startOfMonth(new Date()) } }),
    CompanyAsset.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    PerformanceReport.countDocuments({ status: { $nin: [REPORT_STATUS.COMPLETED, REPORT_STATUS.HR_APPROVED] } }),
  ]);

  return {
    cards: {
      totalEmployees,
      activeEmployees,
      departments,
      presentToday: todayRecords.filter((item) =>
        [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE, ATTENDANCE_STATUS.EARLY_DEPARTURE, ATTENDANCE_STATUS.HALF_DAY, ATTENDANCE_STATUS.WFH].includes(item.status),
      ).length,
      pendingLeaves,
      pendingFinance,
      pendingHr,
      payrollNet: payrollAgg[0]?.net || 0,
      payrollCount: payrollAgg[0]?.count || 0,
      newJoiners,
      openReports,
      availableAssets: assets.find((item) => item._id === 'AVAILABLE')?.count || 0,
      assignedAssets: assets.find((item) => item._id === 'ASSIGNED')?.count || 0,
    },
    usersByRole: usersByRole.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
    recentActivities: recentAudit,
  };
};

const adminDashboard = async (req) => {
  const settings = await getSettings();
  const today = time.dateKey(new Date(), settings.timezone);
  const [totalEmployees, activeEmployees, departmentStats, todayRecords, pendingLeaves, recentAudit, tasks] = await Promise.all([
    Employee.countDocuments({ isDeleted: false }),
    Employee.countDocuments(activeEmployeeFilter),
    Employee.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ['$department.name', 'Unassigned'] }, count: 1 } },
      { $sort: { count: -1 } },
    ]),
    Attendance.find({ date: today }).select('status').lean(),
    LeaveRequest.countDocuments({ status: LEAVE_STATUS.PENDING }),
    AuditLog.find({ module: { $in: ['EMPLOYEE', 'DEPARTMENT', 'DESIGNATION', 'ASSET', 'DOCUMENT'] } }).sort({ createdAt: -1 }).limit(8).lean(),
    Employee.aggregate([
      { $match: activeEmployeeFilter },
      { $unwind: { path: '$onboardingTasks', preserveNullAndEmptyArrays: true } },
      { $match: { 'onboardingTasks.completed': false } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]),
  ]);

  return {
    cards: {
      totalEmployees,
      activeEmployees,
      departments: departmentStats.length,
      presentToday: todayRecords.filter((item) =>
        [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE, ATTENDANCE_STATUS.EARLY_DEPARTURE, ATTENDANCE_STATUS.HALF_DAY, ATTENDANCE_STATUS.WFH].includes(item.status),
      ).length,
      pendingLeaves,
      pendingOnboardingTasks: tasks[0]?.count || 0,
    },
    departments: departmentStats,
    recentActivities: recentAudit,
  };
};

const financeDashboard = async (req) => {
  const settings = await getSettings();
  const month = time.monthKey(new Date(), settings.timezone);
  const [awaiting, approved, rejected, forwarded, payrollDraft, payrollApproved, reimb, payrollAgg, recent] = await Promise.all([
    PerformanceReport.countDocuments({ status: { $in: [REPORT_STATUS.SUBMITTED, REPORT_STATUS.UNDER_FINANCE_REVIEW] } }),
    PerformanceReport.countDocuments({ status: REPORT_STATUS.FINANCE_APPROVED }),
    PerformanceReport.countDocuments({ status: REPORT_STATUS.FINANCE_REJECTED }),
    PerformanceReport.countDocuments({ status: REPORT_STATUS.FORWARDED_TO_HR }),
    Payroll.countDocuments({ month, status: 'DRAFT' }),
    Payroll.countDocuments({ month, status: 'APPROVED' }),
    Reimbursement.aggregate([{ $match: { status: 'PENDING' } }, { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Payroll.aggregate([{ $match: { month } }, { $group: { _id: null, net: { $sum: '$netPay' }, gross: { $sum: '$grossEarnings' }, count: { $sum: 1 } } }]),
    PerformanceReport.find({ status: { $in: [REPORT_STATUS.SUBMITTED, REPORT_STATUS.UNDER_FINANCE_REVIEW] } })
      .populate({ path: 'employee', select: 'employeeId firstName lastName department', populate: { path: 'department', select: 'name' } })
      .sort({ submittedAt: -1 })
      .limit(6)
      .select('title periodType periodStart periodEnd submittedAt status employee')
      .lean(),
  ]);

  return {
    month,
    cards: {
      awaitingVerification: awaiting,
      approvedReports: approved,
      rejectedReports: rejected,
      forwardedToHr: forwarded,
      payrollPending: payrollDraft,
      payrollApproved,
      pendingReimbursements: reimb[0]?.count || 0,
      pendingReimbursementAmount: reimb[0]?.amount || 0,
      monthNetPayroll: payrollAgg[0]?.net || 0,
      monthGrossPayroll: payrollAgg[0]?.gross || 0,
      monthPayrollCount: payrollAgg[0]?.count || 0,
    },
    recentReports: recent,
  };
};

const employeeDashboard = async (req) => {
  if (!req.employee) {
    return { needsProfile: true, cards: {}, today: null, monthSummary: null, leaveBalance: null, notifications: [] };
  }
  const settings = await getSettings();
  const year = time.yearOf();
  const month = time.monthKey(new Date(), settings.timezone);
  const [
    today,
    calendar,
    leaveBalance,
    reports,
    payslips,
    notifications,
    announcements,
    assets,
  ] = await Promise.all([
    buildTodayPayload(req.employee, settings),
    getMonthCalendar({ employee: req.employee, month }),
    LeaveBalance.findOne({ employee: req.employee._id, year }).lean(),
    PerformanceReport.find({ employee: req.employee._id }).select('title status periodType periodStart periodEnd overallRating').sort({ createdAt: -1 }).limit(5).lean(),
    Payroll.find({ employee: req.employee._id, status: { $in: ['APPROVED', 'PAID'] } }).sort({ month: -1 }).limit(3).lean(),
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5).lean(),
    Announcement.find({
      isActive: true,
      roles: req.user.role,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    })
      .sort({ isPinned: -1, publishedAt: -1 })
      .limit(3)
      .lean(),
    CompanyAsset.find({ assignedTo: req.employee._id, isDeleted: false }).select('name assetTag category condition').lean(),
  ]);

  const unread = await Notification.countDocuments({ user: req.user._id, isRead: false });
  const pendingLeaves = await LeaveRequest.countDocuments({ employee: req.employee._id, status: LEAVE_STATUS.PENDING });
  const payslipDocs = await Payslip.find({ payroll: { $in: payslips.map((item) => item._id) } }).select('payroll number').lean();
  const payslipMap = payslipDocs.reduce((acc, item) => ({ ...acc, [String(item.payroll)]: item }), {});

  return {
    today,
    month: month,
    monthSummary: calendar.summary,
    calendar: calendar.days.filter((day) => ['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE'].includes(day.status)).slice(-14),
    leaveBalance: leaveBalance
      ? leaveBalance.balances.map((entry) => {
          const meta = (settings.leaveTypes || []).find((type) => type.code === entry.type);
          return {
            type: entry.type,
            name: meta?.name || entry.type,
            available: Math.max(0, (entry.allocated || 0) + (entry.carriedForward || 0) - (entry.used || 0) - (entry.pending || 0)),
            allocated: entry.allocated,
            used: entry.used,
          };
        })
      : [],
    cards: {
      pendingLeaves,
      unreadNotifications: unread,
      reportsTotal: reports.length,
      pendingReports: reports.filter((item) => !['COMPLETED', 'HR_APPROVED', 'FINANCE_REJECTED', 'HR_REJECTED'].includes(item.status)).length,
      assets: assets.length,
    },
    reports,
    payslips: payslips.map((item) => ({ ...item, payslip: payslipMap[String(item._id)] || null })),
    notifications,
    announcements,
  };
};

const hrDashboard = async (req) => {
  const settings = await getSettings();
  const [totalEmployees, newJoiners, onLeave, pendingLeaves, awaitingReview, approvedReports, onboarding, recentReports, deptStats] = await Promise.all([
    Employee.countDocuments(activeEmployeeFilter),
    Employee.countDocuments({ isDeleted: false, dateOfJoining: { $gte: time.startOfMonth(new Date()) } }),
    LeaveRequest.countDocuments({ status: LEAVE_STATUS.APPROVED, startDate: { $lte: new Date() }, endDate: { $gte: new Date() } }),
    LeaveRequest.countDocuments({ status: LEAVE_STATUS.PENDING }),
    PerformanceReport.countDocuments({ status: { $in: [REPORT_STATUS.FORWARDED_TO_HR, REPORT_STATUS.UNDER_HR_REVIEW] } }),
    PerformanceReport.countDocuments({ status: { $in: [REPORT_STATUS.HR_APPROVED, REPORT_STATUS.COMPLETED] } }),
    Employee.aggregate([
      { $match: { isDeleted: false } },
      { $unwind: { path: '$onboardingTasks', preserveNullAndEmptyArrays: true } },
      { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: ['$onboardingTasks.completed', 1, 0] } } } },
    ]),
    PerformanceReport.find({ status: { $in: [REPORT_STATUS.FORWARDED_TO_HR, REPORT_STATUS.UNDER_HR_REVIEW] } })
      .populate({ path: 'employee', select: 'employeeId firstName lastName department', populate: { path: 'department', select: 'name' } })
      .sort({ forwardedToHrAt: -1 })
      .limit(6)
      .select('title status periodType submittedAt employee')
      .lean(),
    Employee.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ['$department.name', 'Unassigned'] }, count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const totalTasks = onboarding[0]?.total || 0;
  const completedTasks = onboarding[0]?.completed || 0;

  return {
    cards: {
      totalEmployees,
      newJoiners,
      onLeave,
      pendingLeaves,
      reportsAwaitingReview: awaitingReview,
      approvedReports,
      onboardingCompleted: completedTasks,
      onboardingTotal: totalTasks,
      onboardingProgress: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
    departments: deptStats,
    recentReports,
  };
};

router.get('/', asyncHandler(async (req, res) => {
  const settings = await getSettings();
  let data;
  switch (req.user.role) {
    case ROLES.SUPER_ADMIN:
      data = await superAdminDashboard(req);
      break;
    case ROLES.ADMIN:
      data = await adminDashboard(req);
      break;
    case ROLES.HR:
      data = await hrDashboard(req);
      break;
    case ROLES.FINANCE:
      data = await financeDashboard(req);
      break;
    default:
      data = await employeeDashboard(req);
  }
  const pulse = await buildPulse(settings);
  res.json({
    success: true,
    data: {
      role: req.user.role,
      company: {
        name: settings.companyName,
        timezone: settings.timezone,
        workingDays: settings.workingDays,
        workStartTime: settings.workStartTime,
        workEndTime: settings.workEndTime,
        currency: settings.currency,
      },
      ...data,
      pulse,
    },
  });
}));

module.exports = router;
