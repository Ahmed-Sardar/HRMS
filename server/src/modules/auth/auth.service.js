const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const Employee = require('../../models/Employee');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  randomToken,
  randomJti,
} = require('../../utils/token');
const { sendPasswordResetEmail } = require('../../utils/mail');
const { logAudit } = require('../../utils/audit');
const { ROLE_PERMISSIONS } = require('../../config/permissions');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const recordLoginHistory = async (user, { ip, userAgent, success, reason }) => {
  user.loginHistory = [
    { at: new Date(), ip, userAgent, success, reason },
    ...(user.loginHistory || []),
  ].slice(0, 25);
  await user.save({ validateBeforeSave: false });
};

const issueTokens = async (user, { ip, userAgent }) => {
  const jti = randomJti();
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, jti);

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    createdByIp: ip,
    userAgent,
  });

  return { accessToken, refreshToken };
};

const login = async ({ email, password, ip, userAgent, req }) => {
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.isActive) {
    await recordLoginHistory(user, { ip, userAgent, success: false, reason: 'ACCOUNT_INACTIVE' });
    throw ApiError.forbidden('Your account has been deactivated. Contact your administrator.');
  }

  if (user.isLocked) {
    const remaining = Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 60000);
    throw ApiError.forbidden(`Account temporarily locked. Try again in ${Math.max(1, remaining)} minute(s).`);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save({ validateBeforeSave: false });
    await recordLoginHistory(user, { ip, userAgent, success: false, reason: 'BAD_PASSWORD' });
    await logAudit({
      req,
      actor: user,
      action: 'LOGIN_FAILED',
      module: 'AUTH',
      description: `Failed sign-in attempt for ${user.email}`,
      statusCode: 401,
    });
    throw ApiError.unauthorized('Invalid email or password');
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  user.loginHistory = [
    { at: new Date(), ip, userAgent, success: true, reason: 'PASSWORD' },
    ...(user.loginHistory || []),
  ].slice(0, 25);
  await user.save({ validateBeforeSave: false });

  const tokens = await issueTokens(user, { ip, userAgent });
  const employee = user.employee
    ? await Employee.findOne({ _id: user.employee, isDeleted: false })
        .populate('department', 'name')
        .populate('designation', 'title')
    : null;

  await logAudit({
    req,
    actor: user,
    action: 'LOGIN',
    module: 'AUTH',
    description: `${user.name} signed in`,
    statusCode: 200,
  });

  return {
    ...tokens,
    user: {
      ...user.toSafeJSON(),
      permissions: ROLE_PERMISSIONS[user.role] || [],
      employeeProfile: employee
        ? {
            id: employee._id,
            employeeId: employee.employeeId,
            fullName: employee.fullName,
            department: employee.department,
            designation: employee.designation,
            profilePhoto: employee.profilePhoto,
          }
        : null,
    },
  };
};

const rotateRefreshToken = async ({ token, ip, userAgent }) => {
  if (!token) throw ApiError.unauthorized('Refresh token is missing');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch (error) {
    throw ApiError.unauthorized('Refresh token is invalid or expired');
  }

  const stored = await RefreshToken.findOne({ tokenHash: hashToken(token) });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Refresh token has been revoked, please sign in again');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('User is not active');

  stored.revokedAt = new Date();
  const jti = randomJti();
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, jti);

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    createdByIp: ip,
    userAgent,
  });
  stored.replacedBy = hashToken(refreshToken);
  await stored.save();

  return { accessToken, refreshToken };
};

const logout = async ({ user, token, req }) => {
  if (token) {
    await RefreshToken.updateMany(
      { user: user._id, tokenHash: hashToken(token), revokedAt: null },
      { revokedAt: new Date() },
    );
  } else {
    await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
  }
  await logAudit({
    req,
    actor: user,
    action: 'LOGOUT',
    module: 'AUTH',
    description: `${user.name} signed out`,
  });
  return { success: true };
};

const forgotPassword = async ({ email, req }) => {
  const user = await User.findOne({ email: String(email).toLowerCase() });
  // Always report success to prevent account enumeration.
  if (!user || !user.isActive) return { sent: true };

  const rawToken = randomToken();
  user.resetPasswordToken = hashToken(rawToken);
  user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${env.clientUrl}/reset-password?token=${rawToken}`;
  const mailResult = await sendPasswordResetEmail(user, resetUrl);

  await logAudit({
    req,
    actor: user,
    action: 'PASSWORD_RESET_REQUESTED',
    module: 'AUTH',
    description: `Password reset requested for ${user.email}`,
  });

  return {
    sent: true,
    // Exposed only outside production so local development works without SMTP.
    resetUrl: env.isProduction || mailResult.messageId ? undefined : resetUrl,
  };
};

const resetPassword = async ({ token, password, req }) => {
  const user = await User.findOne({
    resetPasswordToken: hashToken(token),
    resetPasswordExpires: { $gt: new Date() },
  });
  if (!user) throw ApiError.badRequest('Reset link is invalid or has expired');

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });

  await logAudit({
    req,
    actor: user,
    action: 'PASSWORD_RESET',
    module: 'AUTH',
    description: `Password reset completed for ${user.email}`,
  });

  return { success: true };
};

const changePassword = async ({ user, currentPassword, newPassword, req }) => {
  const fresh = await User.findById(user._id).select('+password');
  const isMatch = await fresh.comparePassword(currentPassword);
  if (!isMatch) throw ApiError.badRequest('Current password is incorrect');
  if (currentPassword === newPassword) {
    throw ApiError.badRequest('New password must be different from the current password');
  }
  fresh.password = newPassword;
  fresh.mustChangePassword = false;
  await fresh.save();
  await RefreshToken.updateMany({ user: fresh._id, revokedAt: null }, { revokedAt: new Date() });

  await logAudit({
    req,
    actor: user,
    action: 'PASSWORD_CHANGED',
    module: 'AUTH',
    description: `${user.name} changed their password`,
  });
  return { success: true };
};

const getProfile = async (user) => {
  const fresh = await User.findById(user._id);
  const employee = fresh.employee
    ? await Employee.findOne({ _id: fresh.employee, isDeleted: false })
        .populate('department', 'name code')
        .populate('designation', 'title code')
        .populate({ path: 'reportingManager', select: 'firstName lastName employeeId' })
    : null;
  return {
    ...fresh.toSafeJSON(),
    permissions: ROLE_PERMISSIONS[fresh.role] || [],
    employeeProfile: employee,
  };
};

const getLoginHistory = async (userId) => {
  const user = await User.findById(userId).select('loginHistory lastLoginAt');
  if (!user) throw ApiError.notFound('User not found');
  return { lastLoginAt: user.lastLoginAt, history: user.loginHistory || [] };
};

module.exports = {
  login,
  logout,
  rotateRefreshToken,
  forgotPassword,
  resetPassword,
  changePassword,
  getProfile,
  getLoginHistory,
};
