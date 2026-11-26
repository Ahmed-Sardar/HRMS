const crypto = require('crypto');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const User = require('../models/User');
const EmailChangeRequest = require('../models/EmailChangeRequest');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const logger = require('../utils/logger');
const { hashToken, randomToken } = require('../utils/token');
const { sendEmailChangeOtp } = require('../utils/mail');
const { logAudit } = require('../utils/audit');
const { notifyEmployee } = require('./notification.service');

const EMAIL_TYPES = { WORK: 'WORK', PERSONAL: 'PERSONAL' };
const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR'];
const OTP_TTL_MINUTES = 15;
const OTP_MAX_ATTEMPTS = 5;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const isEmailManager = (user) => MANAGER_ROLES.includes(user?.role);

const isSelfEmployee = (user, employee) =>
  Boolean(user?.employee && String(user.employee) === String(employee._id)) ||
  Boolean(employee.user && String(employee.user) === String(user?._id));

/** True for accounts anonymized by user deletion; their email must not be reused for login sync. */
const isAnonymizedAccountEmail = (email) => String(email || '').startsWith('deleted-');

const assertCanRequestEmailChange = ({ actor, employee }) => {
  if (!isEmailManager(actor) && !isSelfEmployee(actor, employee)) {
    throw ApiError.forbidden('You can only change your own email addresses');
  }
};

const assertCanManageEmailChange = ({ actor, employee }) => {
  if (!isEmailManager(actor) && !isSelfEmployee(actor, employee)) {
    throw ApiError.forbidden('You are not allowed to manage email addresses for this employee');
  }
};

const assertCanViewHistory = ({ actor, employee }) => {
  if (!isEmailManager(actor) && !isSelfEmployee(actor, employee)) {
    throw ApiError.forbidden('You are not allowed to view this email change history');
  }
};

/**
 * Rejects an address already used by another employee record or another login
 * account. The employee's own record and linked account are excluded.
 */
const assertEmailAvailable = async ({ email, employee, emailType }) => {
  const normalized = normalizeEmail(email);
  if (!normalized) throw ApiError.badRequest('Email is required');

  const otherField =
    emailType === EMAIL_TYPES.WORK ? employee.personalEmail : employee.email;
  if (otherField && normalizeEmail(otherField) === normalized) {
    throw ApiError.conflict(
      emailType === EMAIL_TYPES.WORK
        ? 'The official work email cannot be the same as the personal email'
        : 'The personal email cannot be the same as the official work email',
    );
  }

  const linkedUserId = employee.user || null;
  const [employeeClash, userClash] = await Promise.all([
    Employee.findOne({
      _id: { $ne: employee._id },
      isDeleted: false,
      $or: [{ email: normalized }, { personalEmail: normalized }],
    }).select('employeeId firstName lastName email personalEmail'),
    User.findOne({
      email: normalized,
      ...(linkedUserId ? { _id: { $ne: linkedUserId } } : {}),
    }).select('email role isActive'),
  ]);

  if (employeeClash) {
    const name = `${employeeClash.firstName || ''} ${employeeClash.lastName || ''}`.trim();
    const field = employeeClash.email === normalized ? 'official work email' : 'personal email';
    throw ApiError.conflict(
      `This address is already used as the ${field} of ${name || 'another employee'}${
        employeeClash.employeeId ? ` (${employeeClash.employeeId})` : ''
      }`,
    );
  }
  if (userClash) {
    throw ApiError.conflict('This email is already registered to another login account');
  }
  return normalized;
};

let transactionSupport;

/** Detects whether the connected MongoDB deployment supports multi-document transactions. */
const supportsTransactions = async () => {
  if (transactionSupport !== undefined) return transactionSupport;
  try {
    if (mongoose.connection.readyState !== 1) {
      transactionSupport = false;
      return transactionSupport;
    }
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionSupport = Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch {
    transactionSupport = false;
  }
  return transactionSupport;
};

const createHistoryEntry = async (doc, session) => {
  if (session) {
    const [created] = await EmailChangeRequest.create([doc], { session });
    return created;
  }
  return EmailChangeRequest.create(doc);
};

/** Emails that a change request may touch, with the value before the change. */
const buildChanges = ({ employee, workEmail, personalEmail }) => {
  const changes = [];
  if (workEmail !== undefined && workEmail !== null && workEmail !== employee.email) {
    changes.push({ emailType: EMAIL_TYPES.WORK, previousEmail: employee.email, newEmail: workEmail });
  }
  const currentPersonal = employee.personalEmail || '';
  if (personalEmail !== undefined && personalEmail !== null && personalEmail !== currentPersonal) {
    changes.push({ emailType: EMAIL_TYPES.PERSONAL, previousEmail: currentPersonal, newEmail: personalEmail });
  }
  return changes;
};

/**
 * Persists email changes on the Employee document, keeps the linked login User
 * account in sync for the official work email, and writes history entries.
 * Uses a transaction when the deployment supports it; otherwise saves
 * sequentially and restores the previous values if the user account fails.
 */
const persistEmailChange = async ({ employee, changes, actor, req, request, reason }) => {
  if (!changes.length) return { histories: [] };

  const linkedUser = employee.user ? await User.findById(employee.user) : null;
  const workChange = changes.find((change) => change.emailType === EMAIL_TYPES.WORK);
  const syncLoginEmail =
    Boolean(workChange && linkedUser && !isAnonymizedAccountEmail(linkedUser.email));
  const actorId = actor?._id;
  const actorName = actor?.name;
  const now = new Date();

  changes.forEach((change) => {
    if (change.emailType === EMAIL_TYPES.WORK) employee.email = change.newEmail;
    else employee.personalEmail = change.newEmail;
  });

  const historyDocs = changes.map((change) => ({
    employee: employee._id,
    user: employee.user || undefined,
    emailType: change.emailType,
    previousEmail: change.previousEmail,
    newEmail: change.newEmail,
    requestedBy: request ? request.requestedBy : actorId,
    requestedByName: request ? request.requestedByName : actorName,
    changedBy: actorId,
    changedByName: actorName,
    status: 'APPLIED',
    verificationStatus: request ? 'VERIFIED' : 'NOT_REQUIRED',
    approvalStatus: 'APPROVED',
    verifiedAt: request ? now : undefined,
    appliedAt: now,
    reason: reason || (request ? request.reason : undefined),
  }));

  const apply = async (session) => {
    await employee.save({ session: session || undefined });
    if (syncLoginEmail) {
      linkedUser.email = workChange.newEmail;
      await linkedUser.save({ session: session || undefined });
    }

    if (request) {
      request.status = 'APPLIED';
      request.verificationStatus = 'VERIFIED';
      request.approvalStatus = 'APPROVED';
      request.verifiedAt = now;
      request.appliedAt = now;
      request.changedBy = actorId;
      request.changedByName = actorName;
      if (session) await request.save({ session });
      else await request.save();
      return { request, histories: [request] };
    }

    if (session) {
      const created = await EmailChangeRequest.create(historyDocs, { session });
      return { histories: created };
    }
    const created = [];
    for (const doc of historyDocs) created.push(await createHistoryEntry(doc, null));
    return { histories: created };
  };

  if (await supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await apply(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  try {
    return await apply(null);
  } catch (error) {
    // Compensating update: never leave the employee record ahead of the login account.
    changes.forEach((change) => {
      if (change.emailType === EMAIL_TYPES.WORK) employee.email = change.previousEmail;
      else employee.personalEmail = change.previousEmail;
    });
    await employee.save({ validateBeforeSave: false });
    throw error;
  }
};

const requestEmailChange = async ({ employee, emailType, newEmail, reason, actor, req }) => {
  assertCanRequestEmailChange({ actor, employee });
  if (!Object.values(EMAIL_TYPES).includes(emailType)) {
    throw ApiError.badRequest('Unsupported email type');
  }

  const normalized = normalizeEmail(newEmail);
  if (!normalized) throw ApiError.badRequest('Email is required');

  const linkedUser = employee.user ? await User.findById(employee.user) : null;
  if (linkedUser?.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
    throw ApiError.forbidden('Only a super admin can change a super admin login email');
  }

  const currentValue = emailType === EMAIL_TYPES.WORK ? employee.email : employee.personalEmail || '';
  if (normalized === normalizeEmail(currentValue)) {
    throw ApiError.badRequest(
      emailType === EMAIL_TYPES.WORK
        ? 'This is already the official work email'
        : 'This is already the personal email',
    );
  }

  await assertEmailAvailable({ email: normalized, employee, emailType });

  // A new request supersedes any older pending request of the same type.
  await EmailChangeRequest.updateMany(
    { employee: employee._id, emailType, status: 'PENDING_VERIFICATION' },
    { status: 'CANCELLED', verificationStatus: 'EXPIRED' },
  );

  const otp = String(crypto.randomInt(100000, 1000000));
  const token = randomToken();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  const request = await EmailChangeRequest.create({
    employee: employee._id,
    user: employee.user,
    emailType,
    previousEmail: currentValue,
    newEmail: normalized,
    requestedBy: actor._id,
    requestedByName: actor.name,
    status: 'PENDING_VERIFICATION',
    verificationStatus: 'PENDING',
    approvalStatus: 'PENDING',
    otpHash: hashToken(otp),
    tokenHash: hashToken(token),
    expiresAt,
    reason,
  });

  const mailResult = await sendEmailChangeOtp({
    to: normalized,
    name: employee.fullName,
    otp,
    emailType,
    expiresMinutes: OTP_TTL_MINUTES,
    requestedBy: actor.name,
  });

  const delivered = !mailResult.skipped;
  const configured = Boolean(env.mail.host && env.mail.user);
  if (!delivered) {
    logger.warn(
      `[email-change] SMTP not configured; verification code for ${normalized} is ${otp} (development only)`,
    );
  }

  await logAudit({
    req,
    actor,
    action: 'EMAIL_CHANGE_REQUESTED',
    module: 'EMPLOYEE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `Verification requested for ${emailType.toLowerCase()} email change to ${normalized}`,
    newValue: { emailType, previousEmail: currentValue, newEmail: normalized },
  });

  return {
    request: request.toSafeJSON(),
    delivery: {
      configured,
      sent: delivered,
      reason: mailResult.reason || mailResult.error,
    },
    // Exposed only outside production when SMTP is unavailable, mirroring the
    // existing password reset development fallback. Never persisted in plain text.
    devOtp: !env.isProduction && !delivered ? otp : undefined,
  };
};

const verifyEmailChange = async ({ employee, requestId, otp, actor, req }) => {
  assertCanManageEmailChange({ actor, employee });

  const request = await EmailChangeRequest.findOne({
    _id: requestId,
    employee: employee._id,
  }).select('+otpHash +tokenHash');
  if (!request) throw ApiError.notFound('Email change request not found');
  if (request.status !== 'PENDING_VERIFICATION') {
    throw ApiError.badRequest('This email change request is no longer pending');
  }
  if (request.expiresAt && request.expiresAt.getTime() < Date.now()) {
    request.status = 'EXPIRED';
    request.verificationStatus = 'EXPIRED';
    await request.save();
    throw ApiError.badRequest('The verification code has expired. Please request a new one.');
  }
  if (request.attempts >= OTP_MAX_ATTEMPTS) {
    request.status = 'CANCELLED';
    await request.save();
    throw ApiError.badRequest('Too many incorrect attempts. Please request a new code.');
  }

  request.attempts += 1;
  if (hashToken(String(otp || '').trim()) !== request.otpHash) {
    await request.save();
    throw ApiError.badRequest('Incorrect verification code');
  }

  const targetEmail = await assertEmailAvailable({
    email: request.newEmail,
    employee,
    emailType: request.emailType,
  });

  await persistEmailChange({
    employee,
    changes: [
      {
        emailType: request.emailType,
        previousEmail: request.previousEmail,
        newEmail: targetEmail,
      },
    ],
    actor,
    req,
    request,
  });

  const label = request.emailType === EMAIL_TYPES.WORK ? 'Official work email' : 'Personal email';
  await notifyEmployee(employee._id, {
    title: `${label} updated`,
    message:
      request.emailType === EMAIL_TYPES.WORK
        ? `Your official work email is now ${targetEmail}. Use it to sign in from now on.`
        : `Your personal email is now ${targetEmail}.`,
    type: 'HR',
    link: '/profile',
  }).catch(() => {});

  await logAudit({
    req,
    actor,
    action: 'EMAIL_CHANGE_VERIFIED',
    module: 'EMPLOYEE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `${label} changed from ${request.previousEmail || '—'} to ${targetEmail}`,
    previousValue: { email: request.previousEmail },
    newValue: { email: targetEmail, emailType: request.emailType },
  });

  return { request: request.toSafeJSON(), email: targetEmail, emailType: request.emailType };
};

const listEmailHistory = async ({ employee, actor, limit = 25 }) => {
  assertCanViewHistory({ actor, employee });
  const items = await EmailChangeRequest.find({ employee: employee._id })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 25, 100));
  return items.map((item) => item.toSafeJSON());
};

const pendingRequests = async ({ employee, actor }) => {
  assertCanViewHistory({ actor, employee });
  const items = await EmailChangeRequest.find({
    employee: employee._id,
    status: 'PENDING_VERIFICATION',
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
  return items.map((item) => item.toSafeJSON());
};

module.exports = {
  supportsTransactions,
  EMAIL_TYPES,
  normalizeEmail,
  isEmailManager,
  isSelfEmployee,
  isAnonymizedAccountEmail,
  assertCanRequestEmailChange,
  assertCanManageEmailChange,
  assertEmailAvailable,
  buildChanges,
  persistEmailChange,
  requestEmailChange,
  verifyEmailChange,
  listEmailHistory,
  pendingRequests,
};
