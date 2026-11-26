const asyncHandler = require('../../utils/asyncHandler');
const env = require('../../config/env');
const authService = require('./auth.service');
const { logAudit } = require('../../utils/audit');

const REFRESH_COOKIE = 'hrms_refresh_token';

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'strict' : 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login({
    ...req.body,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    req,
  });
  res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());
  res.json({
    success: true,
    message: 'Signed in successfully',
    data: { accessToken: result.accessToken, user: result.user },
  });
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  const tokens = await authService.rotateRefreshToken({
    token,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions());
  res.json({ success: true, data: { accessToken: tokens.accessToken } });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  await authService.logout({ user: req.user, token, req });
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ success: true, message: 'Signed out successfully' });
});

const me = asyncHandler(async (req, res) => {
  const profile = await authService.getProfile(req.user);
  res.json({ success: true, data: profile });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword({ email: req.body.email, req });
  res.json({
    success: true,
    message: 'If an account exists for that email, a reset link has been sent.',
    data: result.resetUrl ? { resetUrl: result.resetUrl } : undefined,
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword({ token: req.params.token, password: req.body.password, req });
  res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword({
    user: req.user,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
    req,
  });
  res.json({ success: true, message: 'Password changed successfully. Please sign in again.' });
});

const loginHistory = asyncHandler(async (req, res) => {
  const history = await authService.getLoginHistory(req.user._id);
  res.json({ success: true, data: history });
});

const listSessions = asyncHandler(async (req, res) => {
  const RefreshToken = require('../../models/RefreshToken');
  const sessions = await RefreshToken.find({ user: req.user._id, revokedAt: null, expiresAt: { $gt: new Date() } })
    .select('createdAt expiresAt createdByIp userAgent')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: sessions });
});

const revokeSessions = asyncHandler(async (req, res) => {
  const RefreshToken = require('../../models/RefreshToken');
  await RefreshToken.updateMany({ user: req.user._id, revokedAt: null }, { revokedAt: new Date() });
  await logAudit({
    req,
    action: 'SESSIONS_REVOKED',
    module: 'AUTH',
    description: `${req.user.name} revoked all active sessions`,
  });
  res.json({ success: true, message: 'All sessions revoked' });
});

module.exports = {
  login,
  refresh,
  logout,
  me,
  forgotPassword,
  resetPassword,
  changePassword,
  loginHistory,
  listSessions,
  revokeSessions,
  REFRESH_COOKIE,
};
