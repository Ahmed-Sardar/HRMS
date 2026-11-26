const asyncHandler = require('../../utils/asyncHandler');
const userService = require('./user.service');

const list = asyncHandler(async (req, res) => {
  const data = await userService.listUsers(req.validatedQuery || req.query);
  res.json({ success: true, data });
});

const getOne = asyncHandler(async (req, res) => {
  const data = await userService.getUser(req.params.id);
  res.json({ success: true, data });
});

const create = asyncHandler(async (req, res) => {
  const data = await userService.createUser({ payload: req.body, actor: req.user, req });
  res.status(201).json({ success: true, message: 'User account created', data });
});

const update = asyncHandler(async (req, res) => {
  const data = await userService.updateUser(req.params.id, req.body, req.user, req);
  res.json({ success: true, message: 'User updated', data });
});

const changeRole = asyncHandler(async (req, res) => {
  const data = await userService.changeRole(req.params.id, req.body.role, req.user, req);
  res.json({ success: true, message: 'Role updated', data });
});

const setStatus = asyncHandler(async (req, res) => {
  const data = await userService.setStatus(req.params.id, req.body.isActive, req.user, req);
  res.json({ success: true, message: 'Account status updated', data });
});

const resetPassword = asyncHandler(async (req, res) => {
  const data = await userService.resetUserPassword(req.params.id, req.body.password, req.user, req);
  res.json({ success: true, message: 'Password reset. The user must change it on next sign in.', data });
});

const remove = asyncHandler(async (req, res) => {
  const data = await userService.deactivateUser(req.params.id, req.user, req);
  res.json({ success: true, message: 'User account deactivated', data });
});

module.exports = { list, getOne, create, update, changeRole, setStatus, resetPassword, remove };
