/* eslint-disable no-console */
const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { ROLES, ATTENDANCE_STATUS, REPORT_STATUS, LEAVE_STATUS, EMPLOYMENT_STATUS } = require('../config/constants');

const User = require('../models/User');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Shift = require('../models/Shift');
const Holiday = require('../models/Holiday');
const CompanySettings = require('../models/CompanySettings');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
const SalaryStructure = require('../models/SalaryStructure');
const PerformanceReport = require('../models/PerformanceReport');
const Announcement = require('../models/Announcement');
const CompanyAsset = require('../models/CompanyAsset');
const Notification = require('../models/Notification');
const Role = require('../models/Role');
const ReportApprovalHistory = require('../models/ReportApprovalHistory');
const time = require('../utils/time');

const PASSWORD = 'Admin@12345';

const dayKey = (offset) => {
  const date = time.dayjs().subtract(offset, 'day');
  return date.format('YYYY-MM-DD');
};

const buildAttendance = ({ employeeId, shiftId, key, status = ATTENDANCE_STATUS.PRESENT, late = 0 }) => {
  const checkIn = time.combineDateAndTime(key, late ? '09:35' : '09:02');
  const checkOut = time.combineDateAndTime(key, '18:15');
  const breakStart = time.combineDateAndTime(key, '13:00');
  const breakEnd = time.combineDateAndTime(key, '13:45');
  const effectiveMinutes = time.diffMinutes(checkIn, checkOut) - 45;
  return {
    employee: employeeId,
    date: key,
    attendanceDate: time.startOfDay(time.combineDateAndTime(key, '00:00')),
    shift: shiftId,
    checkIn,
    checkOut,
    breaks: [{ start: breakStart, end: breakEnd, durationMinutes: 45, type: 'LUNCH' }],
    status,
    workedMinutes: time.diffMinutes(checkIn, checkOut),
    breakMinutes: 45,
    effectiveMinutes,
    overtimeMinutes: Math.max(0, effectiveMinutes - 480),
    lateMinutes: late,
    isLate: late > 0,
    source: 'SELF',
    events: [
      { type: 'CHECK_IN', at: checkIn },
      { type: 'BREAK_START', at: breakStart },
      { type: 'BREAK_END', at: breakEnd },
      { type: 'CHECK_OUT', at: checkOut },
    ],
    originalEvents: [{ type: 'CHECK_IN', at: checkIn }, { type: 'CHECK_OUT', at: checkOut }],
  };
};

const seed = async () => {
  await connectDB();

  const existing = await User.findOne({ email: 'superadmin@hrms.com' });
  if (existing) {
    console.log('Seed data already present (superadmin@hrms.com exists). Skipping.');
    await disconnectDB();
    return;
  }

  console.log('Seeding HRMS demo data...');

  const settings =
    (await CompanySettings.findOne({ key: 'company' })) ||
    (await CompanySettings.create({
      key: 'company',
      companyName: 'Northwind Technologies',
      legalName: 'Northwind Technologies Pvt. Ltd.',
      email: 'people@northwind.example',
      phone: '+91 22 4000 1200',
      website: 'https://northwind.example',
      address: '14th Floor, Trade Tower, Bandra Kurla Complex, Mumbai 400051',
      timezone: 'Asia/Kolkata',
      workingDays: [1, 2, 3, 4, 5],
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      fullDayMinutes: 480,
      halfDayMinutes: 240,
      overtimeMultiplier: 1.5,
      payrollDay: 28,
      probationMonths: 3,
      noticePeriodDays: 30,
    }));

  await Role.deleteMany({});
  await Role.insertMany(Role.defaults());

  const departmentSeeds = [
    { name: 'Engineering', code: 'ENG', description: 'Product engineering and platform teams' },
    { name: 'Human Resources', code: 'HR', description: 'People operations and talent' },
    { name: 'Finance', code: 'FIN', description: 'Accounting, payroll and compliance' },
    { name: 'Sales', code: 'SAL', description: 'Revenue and customer acquisition' },
    { name: 'Operations', code: 'OPS', description: 'Business operations and support' },
  ];
  const departments = {};
  for (const dept of departmentSeeds) {
    departments[dept.code] = await Department.create({ ...dept, email: `${dept.code.toLowerCase()}@northwind.example` });
  }

  const designationSeeds = [
    { title: 'Engineering Manager', code: 'ENG-MGR', department: 'ENG', level: 'L5' },
    { title: 'Senior Software Engineer', code: 'ENG-SSE', department: 'ENG', level: 'L4' },
    { title: 'Software Engineer', code: 'ENG-SE', department: 'ENG', level: 'L3' },
    { title: 'HR Manager', code: 'HR-MGR', department: 'HR', level: 'L5' },
    { title: 'Finance Manager', code: 'FIN-MGR', department: 'FIN', level: 'L5' },
    { title: 'Payroll Executive', code: 'FIN-PAY', department: 'FIN', level: 'L2' },
    { title: 'Account Executive', code: 'SAL-AE', department: 'SAL', level: 'L3' },
    { title: 'Operations Executive', code: 'OPS-EXE', department: 'OPS', level: 'L2' },
  ];
  const designations = {};
  for (const item of designationSeeds) {
    designations[item.code] = await Designation.create({
      title: item.title,
      code: item.code,
      level: item.level,
      department: departments[item.department]._id,
    });
  }

  const generalShift = await Shift.create({
    name: 'General Shift',
    code: 'GEN',
    startTime: '09:00',
    endTime: '18:00',
    graceMinutes: 15,
    breakMinutes: 60,
    weeklyOffs: [0, 6],
    isDefault: true,
  });
  await Shift.create({
    name: 'Evening Shift',
    code: 'EVE',
    startTime: '14:00',
    endTime: '23:00',
    graceMinutes: 10,
    breakMinutes: 60,
    weeklyOffs: [0, 6],
    isDefault: false,
  });

  const year = new Date().getFullYear();
  const holidaySeeds = [
    { name: "New Year's Day", date: `${year}-01-01`, type: 'PUBLIC' },
    { name: 'Republic Day', date: `${year}-01-26`, type: 'PUBLIC' },
    { name: 'Holi', date: `${year}-03-14`, type: 'PUBLIC' },
    { name: 'Independence Day', date: `${year}-08-15`, type: 'PUBLIC' },
    { name: 'Gandhi Jayanti', date: `${year}-10-02`, type: 'PUBLIC' },
    { name: 'Diwali', date: `${year}-11-08`, type: 'PUBLIC' },
    { name: 'Christmas', date: `${year}-12-25`, type: 'PUBLIC' },
  ];
  for (const holiday of holidaySeeds) {
    await Holiday.create({ ...holiday, date: new Date(holiday.date) });
  }

  const superAdminUser = await User.create({
    name: 'Priya Raman',
    email: 'superadmin@hrms.com',
    password: PASSWORD,
    role: ROLES.SUPER_ADMIN,
  });

  const adminUser = await User.create({
    name: 'Arjun Mehta',
    email: 'admin@hrms.com',
    password: PASSWORD,
    role: ROLES.ADMIN,
  });

  const hrUser = await User.create({
    name: 'Neha Kapoor',
    email: 'hr@hrms.com',
    password: PASSWORD,
    role: ROLES.HR,
  });

  const financeUser = await User.create({
    name: 'Rahul Verma',
    email: 'finance@hrms.com',
    password: PASSWORD,
    role: ROLES.FINANCE,
  });

  const employeeUser = await User.create({
    name: 'Aditya Sharma',
    email: 'employee@hrms.com',
    password: PASSWORD,
    role: ROLES.EMPLOYEE,
  });

  const manager = await Employee.create({
    employeeId: 'EMP2024001',
    user: hrUser._id,
    firstName: 'Neha',
    lastName: 'Kapoor',
    email: 'hr@hrms.com',
    phone: '+91 98200 11001',
    department: departments.HR._id,
    designation: designations['HR-MGR']._id,
    dateOfJoining: new Date(`${year - 3}-02-12`),
    employmentType: 'FULL_TIME',
    workLocation: 'Mumbai HQ',
    employmentStatus: EMPLOYMENT_STATUS.ACTIVE,
    shift: generalShift._id,
    skills: ['Talent Acquisition', 'Employee Relations', 'HRIS'],
    bankDetails: { accountName: 'Neha Kapoor', accountNumber: '50100234567890', bankName: 'HDFC Bank', ifscCode: 'HDFC0000123' },
    onboardingTasks: [{ title: 'Complete joining formalities', owner: 'HR', completed: true, completedAt: new Date() }],
  });
  hrUser.employee = manager._id;
  await hrUser.save({ validateBeforeSave: false });

  const employee = await Employee.create({
    employeeId: 'EMP2024002',
    user: employeeUser._id,
    firstName: 'Aditya',
    lastName: 'Sharma',
    email: 'employee@hrms.com',
    personalEmail: 'aditya.sharma@example.com',
    phone: '+91 98200 11002',
    dateOfBirth: new Date(`${year - 29}-06-18`),
    gender: 'MALE',
    department: departments.ENG._id,
    designation: designations['ENG-SSE']._id,
    reportingManager: manager._id,
    dateOfJoining: new Date(`${year - 2}-04-05`),
    employmentType: 'FULL_TIME',
    workLocation: 'Mumbai HQ',
    employmentStatus: EMPLOYMENT_STATUS.ACTIVE,
    shift: generalShift._id,
    skills: ['MongoDB', 'Node.js', 'React', 'System Design', 'AWS'],
    about: 'Full stack engineer focused on building reliable HR and finance platforms.',
    address: { line1: 'B-704, Sunrise Residency', city: 'Mumbai', state: 'Maharashtra', country: 'India', postalCode: '400058' },
    emergencyContact: { name: 'Meera Sharma', relation: 'Mother', phone: '+91 98200 44002' },
    bankDetails: { accountName: 'Aditya Sharma', accountNumber: '50100987654321', bankName: 'ICICI Bank', ifscCode: 'ICIC0000456' },
    onboardingTasks: [
      { title: 'Submit signed offer letter', owner: 'EMPLOYEE', completed: true, completedAt: new Date() },
      { title: 'Upload identity documents', owner: 'EMPLOYEE', completed: true, completedAt: new Date() },
      { title: 'Acknowledge company policies', owner: 'HR', completed: false },
    ],
  });
  employeeUser.employee = employee._id;
  await employeeUser.save({ validateBeforeSave: false });

  const staffSeeds = [
    { email: 'admin@hrms.com', user: adminUser, employeeId: 'EMP2024003', firstName: 'Arjun', lastName: 'Mehta', dept: 'OPS', desig: 'OPS-EXE' },
    { email: 'finance@hrms.com', user: financeUser, employeeId: 'EMP2024004', firstName: 'Rahul', lastName: 'Verma', dept: 'FIN', desig: 'FIN-MGR' },
  ];
  const staffEmployees = [];
  for (const item of staffSeeds) {
    const record = await Employee.create({
      employeeId: item.employeeId,
      user: item.user._id,
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email,
      department: departments[item.dept]._id,
      designation: designations[item.desig]._id,
      reportingManager: manager._id,
      dateOfJoining: new Date(`${year - 1}-07-01`),
      employmentType: 'FULL_TIME',
      workLocation: 'Mumbai HQ',
      employmentStatus: EMPLOYMENT_STATUS.ACTIVE,
      shift: generalShift._id,
    });
    item.user.employee = record._id;
    await item.user.save({ validateBeforeSave: false });
    staffEmployees.push(record);
  }

  const superAdminEmployee = await Employee.create({
    employeeId: 'EMP2024000',
    user: superAdminUser._id,
    firstName: 'Priya',
    lastName: 'Raman',
    email: 'superadmin@hrms.com',
    department: departments.HR._id,
    designation: designations['HR-MGR']._id,
    dateOfJoining: new Date(`${year - 4}-01-08`),
    employmentType: 'FULL_TIME',
    workLocation: 'Mumbai HQ',
    employmentStatus: EMPLOYMENT_STATUS.ACTIVE,
    shift: generalShift._id,
    skills: ['People Strategy', 'Governance', 'HR Technology'],
  });
  superAdminUser.employee = superAdminEmployee._id;
  await superAdminUser.save({ validateBeforeSave: false });

  const teamSeeds = [
    { employeeId: 'EMP2024005', firstName: 'Sara', lastName: 'Iyer', dept: 'ENG', desig: 'ENG-SE', doj: `${year}-01-15` },
    { employeeId: 'EMP2024006', firstName: 'Karan', lastName: 'Patel', dept: 'ENG', desig: 'ENG-SE', doj: `${year}-02-01` },
    { employeeId: 'EMP2024007', firstName: 'Ritika', lastName: 'Nair', dept: 'SAL', desig: 'SAL-AE', doj: `${year - 1}-09-10` },
    { employeeId: 'EMP2024008', firstName: 'Vikram', lastName: 'Desai', dept: 'FIN', desig: 'FIN-PAY', doj: `${year - 1}-11-20` },
  ];

  const teamEmployees = [];
  for (const item of teamSeeds) {
    const email = `${item.firstName.toLowerCase()}.${item.lastName.toLowerCase()}@northwind.example`;
    const user = await User.create({
      name: `${item.firstName} ${item.lastName}`,
      email,
      password: PASSWORD,
      role: ROLES.EMPLOYEE,
    });
    const record = await Employee.create({
      employeeId: item.employeeId,
      user: user._id,
      firstName: item.firstName,
      lastName: item.lastName,
      email,
      phone: `+91 98200 11${item.employeeId.slice(-3)}`,
      department: departments[item.dept]._id,
      designation: designations[item.desig]._id,
      reportingManager: manager._id,
      dateOfJoining: new Date(item.doj),
      employmentType: 'FULL_TIME',
      workLocation: 'Mumbai HQ',
      employmentStatus: EMPLOYMENT_STATUS.ACTIVE,
      shift: generalShift._id,
    });
    user.employee = record._id;
    await user.save({ validateBeforeSave: false });
    teamEmployees.push(record);
  }

  const allEmployees = [manager, employee, ...staffEmployees, ...teamEmployees];

  for (const record of allEmployees) {
    await LeaveBalance.create({
      employee: record._id,
      year,
      balances: (settings.leaveTypes || []).map((type) => ({
        type: type.code,
        allocated: type.annualQuota,
        used: 0,
        pending: 0,
        carriedForward: 0,
      })),
    });
  }

  const salarySeeds = [
    [manager, 85000, 34000, 12000],
    [employee, 72000, 28800, 9000],
    [staffEmployees[0], 55000, 22000, 6000],
    [staffEmployees[1], 80000, 32000, 10000],
    [teamEmployees[0], 48000, 19200, 5000],
    [teamEmployees[1], 46000, 18400, 5000],
    [teamEmployees[2], 42000, 16800, 4000],
    [teamEmployees[3], 38000, 15200, 3500],
  ];
  for (const [record, basic, hra, allowance] of salarySeeds) {
    await SalaryStructure.create({
      employee: record._id,
      effectiveFrom: new Date(`${year - 1}-04-01`),
      basic,
      hra,
      allowances: [
        { name: 'Conveyance Allowance', amount: 1600, type: 'FIXED' },
        { name: 'Special Allowance', amount: allowance, type: 'FIXED' },
      ],
      deductions: [
        { name: 'Provident Fund', amount: Math.round(basic * 0.12) },
        { name: 'Professional Tax', amount: 200 },
      ],
      createdBy: financeUser._id,
    });
  }

  // Attendance for the last 14 calendar days (weekdays only)
  for (let offset = 1; offset <= 14; offset += 1) {
    const key = dayKey(offset);
    const dow = time.dayjs(key).day();
    if (dow === 0 || dow === 6) continue;
    for (const record of allEmployees) {
      const late = offset % 5 === 0 ? 20 : 0;
      await Attendance.create(
        buildAttendance({
          employeeId: record._id,
          shiftId: generalShift._id,
          key,
          status: late ? ATTENDANCE_STATUS.LATE : ATTENDANCE_STATUS.PRESENT,
          late,
        }),
      );
    }
  }

  const leaveSeeds = [
    { employee: employee._id, leaveType: 'CASUAL', days: 2, status: LEAVE_STATUS.APPROVED, reason: 'Family function', offset: 5 },
    { employee: teamEmployees[0]._id, leaveType: 'SICK', days: 1, status: LEAVE_STATUS.PENDING, reason: 'Fever and rest advised' },
    { employee: teamEmployees[2]._id, leaveType: 'EARNED', days: 3, status: LEAVE_STATUS.PENDING, reason: 'Annual vacation with family' },
  ];
  for (const item of leaveSeeds) {
    const start = item.offset ? time.dayjs().subtract(item.offset, 'day') : time.dayjs().add(4, 'day');
    const end = start.add(item.days - 1, 'day');
    const leave = await LeaveRequest.create({
      employee: item.employee,
      leaveType: item.leaveType,
      startDate: start.toDate(),
      endDate: end.toDate(),
      totalDays: item.days,
      reason: item.reason,
      status: item.status,
      reviewedBy: item.status === LEAVE_STATUS.APPROVED ? hrUser._id : undefined,
      reviewedAt: item.status === LEAVE_STATUS.APPROVED ? new Date() : undefined,
      reviewComment: item.status === LEAVE_STATUS.APPROVED ? 'Approved, enjoy your leave.' : undefined,
      history: [
        { action: 'APPLIED', by: employeeUser._id, role: ROLES.EMPLOYEE, comment: item.reason, newStatus: LEAVE_STATUS.PENDING },
      ],
    });
    if (item.status === LEAVE_STATUS.APPROVED) {
      const balance = await LeaveBalance.findOne({ employee: item.employee, year });
      const entry = balance?.balances.find((row) => row.type === item.leaveType);
      if (entry) {
        entry.used += item.days;
        await balance.save();
      }
      let cursor = time.dayjs(leave.startDate);
      while (cursor.isSameOrBefore(time.dayjs(leave.endDate), 'day')) {
        const key = cursor.format('YYYY-MM-DD');
        if (cursor.day() !== 0 && cursor.day() !== 6) {
          await Attendance.findOneAndUpdate(
            { employee: item.employee, date: key },
            { status: ATTENDANCE_STATUS.ON_LEAVE, source: 'SYSTEM' },
            { upsert: true, setDefaultsOnInsert: true },
          );
        }
        cursor = cursor.add(1, 'day');
      }
    }
  }

  const report = await PerformanceReport.create({
    employee: employee._id,
    title: 'Monthly Performance Report',
    periodType: 'MONTHLY',
    periodStart: time.startOfMonth(time.dayjs().subtract(1, 'month').toDate()),
    periodEnd: time.endOfMonth(time.dayjs().subtract(1, 'month').toDate()),
    department: departments.ENG._id,
    reportingManager: manager._id,
    selfAssessment:
      'Delivered the payroll module revamp and improved attendance accuracy. Coordinated with finance to close reconciliation gaps.',
    goals: [
      { title: 'Ship payroll revamp', description: 'Replace legacy payroll calculations', weight: 40, target: '100% rollout', achievement: 'Delivered to production', rating: 5, status: 'COMPLETED' },
      { title: 'Reduce attendance discrepancies', description: 'Fix break tracking edge cases', weight: 30, target: '< 2% discrepancies', achievement: '1.1% discrepancies', rating: 4, status: 'COMPLETED' },
      { title: 'Mentor junior engineers', description: 'Weekly code reviews', weight: 30, target: '4 sessions', achievement: '5 sessions delivered', rating: 4, status: 'COMPLETED' },
    ],
    tasksCompleted: [
      { title: 'Payroll module migration', status: 'COMPLETED', priority: 'HIGH', completionDate: new Date() },
      { title: 'Attendance break validation', status: 'COMPLETED', priority: 'MEDIUM', completionDate: new Date() },
    ],
    kpis: [
      { name: 'Deployment success rate', target: '99%', achieved: '99.6%', score: 98 },
      { name: 'Code review turnaround', target: '24h', achieved: '18h', score: 92 },
    ],
    achievements: 'Recognised as employee of the month for the payroll revamp delivery.',
    projectContributions: 'Owned backend architecture for attendance and payroll services.',
    challenges: 'Legacy data inconsistencies during migration, resolved with staged backfills.',
    skillsDevelopment: 'Completed advanced MongoDB performance tuning certification.',
    employeeComments: 'Looking for more ownership of platform-wide architecture decisions.',
    overallRating: 4.4,
    status: REPORT_STATUS.FORWARDED_TO_HR,
    submittedAt: new Date(),
    financeComments: 'Attendance and leave data verified against records. Approved.',
    financeReviewedAt: new Date(),
    financeReviewedBy: financeUser._id,
    forwardedToHrAt: new Date(),
  });

  await ReportApprovalHistory.insertMany([
    { report: report._id, employee: employee._id, actor: employeeUser._id, actorRole: ROLES.EMPLOYEE, actorName: 'Aditya Sharma', action: 'CREATED', comments: 'Report created', newStatus: REPORT_STATUS.DRAFT },
    { report: report._id, employee: employee._id, actor: employeeUser._id, actorRole: ROLES.EMPLOYEE, actorName: 'Aditya Sharma', action: 'SUBMITTED', comments: 'Submitted for finance verification', previousStatus: REPORT_STATUS.DRAFT, newStatus: REPORT_STATUS.SUBMITTED },
    { report: report._id, employee: employee._id, actor: financeUser._id, actorRole: ROLES.FINANCE, actorName: 'Rahul Verma', action: 'FINANCE_APPROVED', comments: 'Attendance and leave data verified.', previousStatus: REPORT_STATUS.SUBMITTED, newStatus: REPORT_STATUS.FINANCE_APPROVED },
    { report: report._id, employee: employee._id, actor: financeUser._id, actorRole: ROLES.FINANCE, actorName: 'Rahul Verma', action: 'FORWARDED_TO_HR', comments: 'Forwarded to HR for review.', previousStatus: REPORT_STATUS.FINANCE_APPROVED, newStatus: REPORT_STATUS.FORWARDED_TO_HR },
  ]);

  await PerformanceReport.create({
    employee: teamEmployees[0]._id,
    title: 'Monthly Performance Report',
    periodType: 'MONTHLY',
    periodStart: time.startOfMonth(time.dayjs().subtract(1, 'month').toDate()),
    periodEnd: time.endOfMonth(time.dayjs().subtract(1, 'month').toDate()),
    department: departments.ENG._id,
    reportingManager: manager._id,
    selfAssessment: 'Completed onboarding and delivered two customer-facing features.',
    goals: [{ title: 'Deliver onboarding flow', weight: 50, target: 'Launch', achievement: 'Launched', rating: 4, status: 'COMPLETED' }],
    kpis: [{ name: 'Feature delivery', target: '2 features', achieved: '2 features', score: 95 }],
    status: REPORT_STATUS.SUBMITTED,
    submittedAt: new Date(),
  });

  await Announcement.create({
    title: 'Quarterly town hall on Friday',
    content: 'All employees are invited to the quarterly town hall at 4 PM in the main auditorium. The leadership team will share business updates and recognise top performers.',
    category: 'GENERAL',
    priority: 'HIGH',
    isPinned: true,
    createdBy: superAdminUser._id,
  });
  await Announcement.create({
    title: 'Updated leave policy effective this quarter',
    content: 'Casual leave carry-forward has been extended to 5 days. Please review the policy document in the Documents section.',
    category: 'POLICY',
    createdBy: hrUser._id,
  });

  await CompanyAsset.create({
    assetTag: 'LAP-1001',
    name: 'MacBook Pro 14"',
    category: 'LAPTOP',
    brand: 'Apple',
    model: 'M3 Pro',
    serialNumber: 'C02X1234ABCD',
    purchaseDate: new Date(`${year - 1}-06-01`),
    purchaseCost: 195000,
    condition: 'GOOD',
    status: 'ASSIGNED',
    assignedTo: employee._id,
    assignedAt: new Date(`${year - 1}-06-10`),
    assignedBy: adminUser._id,
    history: [{ action: 'CREATED', at: new Date(`${year - 1}-06-01`), by: adminUser._id }, { action: 'ASSIGNED', employee: employee._id, at: new Date(`${year - 1}-06-10`), by: adminUser._id }],
  });
  await CompanyAsset.create({
    assetTag: 'LAP-1002',
    name: 'Dell Latitude 5440',
    category: 'LAPTOP',
    brand: 'Dell',
    purchaseDate: new Date(`${year - 1}-08-15`),
    purchaseCost: 85000,
    condition: 'GOOD',
    status: 'AVAILABLE',
    history: [{ action: 'CREATED', at: new Date(`${year - 1}-08-15`), by: adminUser._id }],
  });
  await CompanyAsset.create({
    assetTag: 'ACC-2001',
    name: 'Access Card - Level 3',
    category: 'ACCESS_CARD',
    status: 'ASSIGNED',
    assignedTo: employee._id,
    assignedAt: new Date(`${year - 1}-06-10`),
    assignedBy: adminUser._id,
    history: [{ action: 'ASSIGNED', employee: employee._id, at: new Date(`${year - 1}-06-10`), by: adminUser._id }],
  });

  await Notification.create([
    {
      user: employeeUser._id,
      employee: employee._id,
      title: 'Payslip available',
      message: 'Your payslip for the previous month is now available for download.',
      type: 'PAYROLL',
      link: '/payroll/my',
    },
    {
      user: employeeUser._id,
      employee: employee._id,
      title: 'Report forwarded to HR',
      message: 'Your monthly performance report was approved by Finance and forwarded to HR.',
      type: 'PERFORMANCE',
      link: `/performance/reports/${report._id}`,
    },
    {
      user: hrUser._id,
      title: 'Performance report awaiting HR review',
      message: 'A performance report was forwarded by Finance and needs your review.',
      type: 'HR',
      link: '/hr/reviews',
    },
  ]);

  console.log('Seed completed.');
  console.log('--------------------------------------------------');
  console.log(`Password for all demo accounts: ${PASSWORD}`);
  console.log('Super Admin : superadmin@hrms.com');
  console.log('Admin       : admin@hrms.com');
  console.log('HR          : hr@hrms.com');
  console.log('Finance     : finance@hrms.com');
  console.log('Employee    : employee@hrms.com');
  console.log('--------------------------------------------------');

  await disconnectDB();
};

seed().catch(async (error) => {
  console.error('Seed failed:', error);
  try {
    await disconnectDB();
  } catch (closeError) {
    console.error(closeError.message);
  }
  process.exitCode = 1;
});

void mongoose;
void env;
