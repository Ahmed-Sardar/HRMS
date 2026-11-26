const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Employee = require('../models/Employee');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const Attendance = require('../models/Attendance');
const AttendanceCorrection = require('../models/AttendanceCorrection');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveBalance = require('../models/LeaveBalance');
const PerformanceReport = require('../models/PerformanceReport');
const PerformanceGoal = require('../models/PerformanceGoal');
const Payroll = require('../models/Payroll');
const Payslip = require('../models/Payslip');
const SalaryStructure = require('../models/SalaryStructure');
const Reimbursement = require('../models/Reimbursement');
const EmployeeDocument = require('../models/EmployeeDocument');
const CompanyAsset = require('../models/CompanyAsset');
const ReportApprovalHistory = require('../models/ReportApprovalHistory');
const Notification = require('../models/Notification');
const EmailChangeRequest = require('../models/EmailChangeRequest');
const DeletionAudit = require('../models/DeletionAudit');
const AuditLog = require('../models/AuditLog');

const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { ROLES, PAYROLL_STATUS, REIMBURSEMENT_STATUS } = require('../config/constants');
const { logAudit } = require('../utils/audit');
const { supportsTransactions } = require('./emailChange.service');

const UNPAID_PAYROLL = [PAYROLL_STATUS.DRAFT, PAYROLL_STATUS.APPROVED];
const OPEN_REIMBURSEMENTS = [REIMBURSEMENT_STATUS.PENDING, REIMBURSEMENT_STATUS.APPROVED];

/** Every collection this workflow understands, with its retention decision. */
const RETENTION_POLICY = Object.freeze({
  delete: [
    'User (authentication account)',
    'RefreshToken (all sessions)',
    'Attendance and embedded break records',
    'AttendanceCorrection',
    'LeaveBalance',
    'PerformanceGoal',
    'EmployeeDocument (records and files)',
    'Notification',
    'EmailChangeRequest (email history)',
  ],
  anonymize: [
    'Employee profile (tombstone: business identifiers only)',
    'LeaveRequest (dates/status kept, personal narrative removed)',
    'PerformanceReport (ratings kept, narrative and attachments removed)',
  ],
  retain: [
    'Payroll (statutory financial record)',
    'Payslip (statutory financial record and stored snapshot)',
    'SalaryStructure (payroll audit trail)',
    'Reimbursement (financial record)',
    'ReportApprovalHistory (approval audit trail)',
    'AuditLog (permanent audit trail)',
    'CompanyAsset and its assignment history (company property record)',
  ],
});

const buildReference = () => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `DEL-${stamp}-${random}`;
};

const unlinkStoredFiles = async (relativePaths) => {
  const root = path.resolve(env.uploadsRoot);
  await Promise.all(
    relativePaths.filter(Boolean).map(async (relative) => {
      const absolute = path.resolve(root, relative);
      if (!absolute.startsWith(root)) return;
      await fs.promises.unlink(absolute).catch(() => {});
    }),
  );
};

const resolveEmployee = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid employee id');
  const employee = await Employee.findById(id);
  if (!employee || employee.isPermanentlyDeleted) throw ApiError.notFound('Employee not found');
  return employee;
};

/** Role, self-deletion and confirmation-field guards (defence in depth behind the route). */
const assertDeletionConfirmed = ({ actor, employee, payload }) => {
  if (actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only a super admin can permanently delete an employee');
  }
  if (String(actor._id) === String(employee.user) || (actor.employee && String(actor.employee) === String(employee._id))) {
    throw ApiError.badRequest('You cannot permanently delete your own employee record');
  }
  if (!payload || payload.acknowledged !== true) {
    throw ApiError.badRequest('You must confirm that you understand permanent deletion');
  }
  if (!payload.reason || String(payload.reason).trim().length < 10) {
    throw ApiError.badRequest('Provide a deletion reason of at least 10 characters');
  }
  if (!payload.employeeId || String(payload.employeeId).trim().toUpperCase() !== employee.employeeId) {
    throw ApiError.badRequest('The employee ID you entered does not match this employee');
  }
};

const verifyActorPassword = async ({ actor, password, req }) => {
  if (!password) throw ApiError.badRequest('Password confirmation is required');
  const fresh = await User.findById(actor._id).select('+password');
  const matches = fresh ? await fresh.comparePassword(password) : false;
  if (!matches) {
    await logAudit({
      req,
      actor,
      action: 'EMPLOYEE_PERMANENT_DELETE_AUTH_FAILED',
      module: 'EMPLOYEE',
      entityType: 'Employee',
      entityId: undefined,
      description: 'Password confirmation failed for a permanent employee deletion attempt',
      statusCode: 401,
    });
    throw ApiError.unauthorized('Password confirmation failed');
  }
};

/**
 * Blocks deletion while mandatory dependencies are unresolved so a delete can
 * never orphan reporting lines, luxury payroll runs or unsettled expenses.
 */
const assertNoBlockingDependencies = async ({ employee }) => {
  const employeeId = employee._id;

  if (employee.user) {
    const linkedUser = await User.findById(employee.user).select('role');
    if (linkedUser && linkedUser.role === ROLES.SUPER_ADMIN) {
      throw ApiError.conflict(
        'This employee is linked to a super admin login. Remove or reassign the super admin role before permanent deletion.',
      );
    }
  }

  const directReports = await Employee.countDocuments({
    reportingManager: employeeId,
    isDeleted: false,
  });
  if (directReports > 0) {
    throw ApiError.conflict(
      `Reassign ${directReports} direct report(s) to another manager before permanent deletion.`,
    );
  }

  const unpaidPayroll = await Payroll.countDocuments({
    employee: employeeId,
    status: { $in: UNPAID_PAYROLL },
  });
  if (unpaidPayroll > 0) {
    throw ApiError.conflict(
      `Finalise and mark ${unpaidPayroll} payroll record(s) as paid before permanent deletion.`,
    );
  }

  const openReimbursements = await Reimbursement.countDocuments({
    employee: employeeId,
    status: { $in: OPEN_REIMBURSEMENTS },
  });
  if (openReimbursements > 0) {
    throw ApiError.conflict(
      `Settle ${openReimbursements} pending reimbursement(s) before permanent deletion.`,
    );
  }
};

const collectRetentionPlan = async (employeeId) => {
  const [payroll, payslips, salaryStructures, reimbursements, approvalHistory, assignedAssets, auditLogs] =
    await Promise.all([
      Payroll.countDocuments({ employee: employeeId }),
      Payslip.countDocuments({ employee: employeeId }),
      SalaryStructure.countDocuments({ employee: employeeId }),
      Reimbursement.countDocuments({ employee: employeeId }),
      ReportApprovalHistory.countDocuments({ employee: employeeId }),
      CompanyAsset.countDocuments({ assignedTo: employeeId, status: 'ASSIGNED' }),
      AuditLog.countDocuments({ entityType: 'Employee', entityId: employeeId }),
    ]);

  return {
    retained: {
      payroll,
      payslips,
      salaryStructures,
      reimbursements,
      reportApprovalHistory: approvalHistory,
      auditLogs,
      companyAssetsReturned: assignedAssets,
    },
  };
};

const anonymizeEmployee = (employee, reference, now) => {
  employee.firstName = 'Deleted';
  employee.lastName = 'Employee';
  employee.email = `deleted-${Date.now()}-${reference.toLowerCase()}@deleted.invalid`;
  employee.personalEmail = undefined;
  employee.phone = undefined;
  employee.altPhone = undefined;
  employee.dateOfBirth = undefined;
  employee.gender = 'UNDISCLOSED';
  employee.maritalStatus = 'SINGLE';
  employee.profilePhoto = undefined;
  employee.address = undefined;
  employee.emergencyContact = undefined;
  employee.bankDetails = undefined;
  employee.skills = [];
  employee.about = undefined;
  employee.onboardingTasks = [];
  employee.user = undefined;
  if (employee.offboarding) {
    employee.offboarding.reason = undefined;
    employee.offboarding.exitInterviewDone = undefined;
  }
  employee.isDeleted = true;
  employee.isPermanentlyDeleted = true;
  employee.deletionReference = reference;
  employee.deletedAt = now;
};

/**
 * Permanently deletes an employee after confirmation, re-authentication and
 * retention/dependency checks. Eligible personal and authentication records are
 * removed, records that must survive are retained or anonymized, all sessions
 * are revoked, and a deletion audit entry is written.
 */
const permanentlyDeleteEmployee = async ({ id, payload, actor, req }) => {
  const employee = await resolveEmployee(id);

  assertDeletionConfirmed({ actor, employee, payload });
  await verifyActorPassword({ actor, password: payload.password, req });
  await assertNoBlockingDependencies({ employee });

  const employeeId = employee._id;
  const userId = employee.user || null;
  const reference = buildReference();
  const now = new Date();
  const { retained } = await collectRetentionPlan(employeeId);

  // Files live outside MongoDB; collect them now and unlink only after commit.
  const [documents, reports] = await Promise.all([
    EmployeeDocument.find({ employee: employeeId }).select('path').lean(),
    PerformanceReport.find({ employee: employeeId }).select('attachments.path').lean(),
  ]);
  const storedFiles = [
    ...documents.map((item) => item.path),
    ...reports.flatMap((item) => (item.attachments || []).map((attachment) => attachment.path)),
  ];

  const deleted = {};
  const anonymized = {};
  const assignedAssets = await CompanyAsset.find({ assignedTo: employeeId, status: 'ASSIGNED' });

  const apply = async (session) => {
    const opts = session ? { session } : {};

    // Retain company property while releasing the assignment.
    for (const asset of assignedAssets) {
      asset.history.push({
        action: 'RETURNED',
        employee: employeeId,
        by: actor._id,
        notes: 'Returned during permanent employee deletion',
      });
      asset.status = 'AVAILABLE';
      asset.assignedTo = undefined;
      asset.assignedAt = undefined;
      asset.expectedReturnDate = undefined;
      asset.returnedAt = now;
      await asset.save(opts);
    }

    // Anonymize records that must remain available for employment/financial history.
    await LeaveRequest.updateMany(
      { employee: employeeId },
      {
        $set: { reason: '[redacted on employee deletion]', 'history.$[].comment': '' },
        $unset: { contactDuringLeave: 1, handoverTo: 1, reviewComment: 1 },
      },
      opts,
    );
    anonymized.leaveRequests = await LeaveRequest.countDocuments({ employee: employeeId }, opts);

    await PerformanceReport.updateMany(
      { employee: employeeId },
      {
        $unset: {
          selfAssessment: 1,
          achievements: 1,
          projectContributions: 1,
          challenges: 1,
          skillsDevelopment: 1,
          employeeComments: 1,
          managerFeedback: 1,
          attachments: 1,
          generatedFiles: 1,
        },
      },
      opts,
    );
    anonymized.performanceReports = await PerformanceReport.countDocuments({ employee: employeeId }, opts);

    anonymizeEmployee(employee, reference, now);
    await employee.save(opts);
    anonymized.employeeProfile = 1;

    // Delete eligible personal, attendance and authentication data.
    const documentResult = await EmployeeDocument.deleteMany({ employee: employeeId }, opts);
    deleted.employeeDocuments = documentResult.deletedCount;

    const attendanceResult = await Attendance.deleteMany({ employee: employeeId }, opts);
    deleted.attendanceRecords = attendanceResult.deletedCount;

    const correctionResult = await AttendanceCorrection.deleteMany({ employee: employeeId }, opts);
    deleted.attendanceCorrections = correctionResult.deletedCount;

    const balanceResult = await LeaveBalance.deleteMany({ employee: employeeId }, opts);
    deleted.leaveBalances = balanceResult.deletedCount;

    const goalResult = await PerformanceGoal.deleteMany({ employee: employeeId }, opts);
    deleted.performanceGoals = goalResult.deletedCount;

    const emailHistoryResult = await EmailChangeRequest.deleteMany(
      userId ? { $or: [{ employee: employeeId }, { user: userId }] } : { employee: employeeId },
      opts,
    );
    deleted.emailChangeRequests = emailHistoryResult.deletedCount;

    const notificationResult = await Notification.deleteMany(
      userId ? { $or: [{ employee: employeeId }, { user: userId }] } : { employee: employeeId },
      opts,
    );
    deleted.notifications = notificationResult.deletedCount;

    if (userId) {
      const tokenResult = await RefreshToken.deleteMany({ user: userId }, opts);
      deleted.refreshTokens = tokenResult.deletedCount;
      const userResult = await User.deleteOne({ _id: userId }, opts);
      deleted.userAccount = userResult.deletedCount;
    } else {
      deleted.refreshTokens = 0;
      deleted.userAccount = 0;
    }

    const [deletionAudit] = await DeletionAudit.create(
      [
        {
          reference,
          employee: employeeId,
          employeeId: employee.employeeId,
          deletedBy: actor._id,
          deletedByName: actor.name,
          deletedByRole: actor.role,
          reason: String(payload.reason).trim(),
          deletedAt: now,
          recordsDeleted: deleted,
          recordsRetained: { ...retained, retentionPolicy: RETENTION_POLICY.retain },
          recordsAnonymized: { ...anonymized, retentionPolicy: RETENTION_POLICY.anonymize },
          ipAddress: req ? req.ip : undefined,
          userAgent: req ? req.get('user-agent') : undefined,
        },
      ],
      opts,
    );
    return deletionAudit;
  };

  let deletionAudit;
  if (await supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        deletionAudit = await apply(session);
      });
    } finally {
      await session.endSession();
    }
  } else {
    // No multi-document transactions on standalone deployments: the operation is
    // still order-safe (retained records are updated before anything is removed).
    deletionAudit = await apply(null);
  }

  await unlinkStoredFiles(storedFiles);

  await logAudit({
    req,
    actor,
    action: 'EMPLOYEE_PERMANENTLY_DELETED',
    module: 'EMPLOYEE',
    entityType: 'Employee',
    entityId: employeeId,
    description: `Permanently deleted employee ${employee.employeeId} (reference ${reference})`,
    newValue: {
      reference,
      recordsDeleted: deleted,
      recordsRetained: retained,
      recordsAnonymized: anonymized,
    },
  });

  return {
    reference,
    employeeId: employee.employeeId,
    deletedAt: deletionAudit.deletedAt,
    deleted,
    retained,
    anonymized,
  };
};

module.exports = {
  permanentlyDeleteEmployee,
  RETENTION_POLICY,
  assertDeletionConfirmed,
  assertNoBlockingDependencies,
};
