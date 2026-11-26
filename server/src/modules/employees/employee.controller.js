const asyncHandler = require('../../utils/asyncHandler');
const service = require('./employee.service');
const ApiError = require('../../utils/ApiError');
const { getEmployeeForUser, getEmployeeOrFail } = require('../../services/employee.service');
const emailChangeService = require('../../services/emailChange.service');
const employeeDeletionService = require('../../services/employeeDeletion.service');

const list = asyncHandler(async (req, res) => {
  const data = await service.listEmployees(req.validatedQuery || req.query, req.user);
  res.json({ success: true, data });
});

const options = asyncHandler(async (req, res) => {
  const data = await service.employeeOptions(req.query.search);
  res.json({ success: true, data });
});

const me = asyncHandler(async (req, res) => {
  if (!req.user.employee) throw ApiError.notFound('No employee profile is linked to your account');
  const employee = await getEmployeeForUser(req.user);
  const data = await service.getEmployeeDetail(employee._id, req.user);
  res.json({ success: true, data });
});

const getOne = asyncHandler(async (req, res) => {
  const data = await service.getEmployeeDetail(req.params.id, req.user);
  res.json({ success: true, data });
});

const create = asyncHandler(async (req, res) => {
  const data = await service.createEmployee({ payload: req.body, actor: req.user, req });
  res.status(201).json({ success: true, message: 'Employee created successfully', data });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.updateEmployee({ id: req.params.id, payload: req.body, actor: req.user, req });
  res.json({ success: true, message: 'Employee updated', data });
});

const updateMe = asyncHandler(async (req, res) => {
  const data = await service.updateSelf({ user: req.user, payload: req.body, req });
  res.json({ success: true, message: 'Profile updated', data });
});

const setStatus = asyncHandler(async (req, res) => {
  const data = await service.setEmploymentStatus({
    id: req.params.id,
    status: req.body.employmentStatus,
    payload: req.body,
    actor: req.user,
    req,
  });
  res.json({ success: true, message: 'Employment status updated', data });
});

const addTask = asyncHandler(async (req, res) => {
  const data = await service.addOnboardingTask({ id: req.params.id, payload: req.body, actor: req.user, req });
  res.status(201).json({ success: true, message: 'Onboarding task added', data });
});

const updateTask = asyncHandler(async (req, res) => {
  const data = await service.updateOnboardingTask({
    id: req.params.id,
    taskId: req.params.taskId,
    payload: req.body,
    actor: req.user,
    req,
  });
  res.json({ success: true, message: 'Onboarding task updated', data });
});

const offboard = asyncHandler(async (req, res) => {
  const data = await service.offboardEmployee({ id: req.params.id, payload: req.body, actor: req.user, req });
  res.json({ success: true, message: 'Employee offboarded', data });
});

const remove = asyncHandler(async (req, res) => {
  const data = await service.deactivateEmployee({ id: req.params.id, actor: req.user, req });
  res.json({ success: true, message: 'Employee deactivated', data });
});

const permanentDelete = asyncHandler(async (req, res) => {
  const data = await employeeDeletionService.permanentlyDeleteEmployee({
    id: req.params.id,
    payload: req.body,
    actor: req.user,
    req,
  });
  res.json({
    success: true,
    message: `Employee permanently deleted (reference ${data.reference})`,
    data,
  });
});

const emailHistory = asyncHandler(async (req, res) => {
  const employee = await getEmployeeOrFail(req.params.id);
  const items = await emailChangeService.listEmailHistory({
    employee,
    actor: req.user,
    limit: req.query.limit,
  });
  res.json({ success: true, data: { items } });
});

const requestEmailChange = asyncHandler(async (req, res) => {
  const employee = await getEmployeeOrFail(req.params.id);
  const data = await emailChangeService.requestEmailChange({
    employee,
    emailType: req.body.emailType,
    newEmail: req.body.newEmail,
    reason: req.body.reason,
    actor: req.user,
    req,
  });
  res.status(201).json({
    success: true,
    message: data.delivery?.sent
      ? 'Verification code sent to the new email address'
      : 'Verification code generated, but email delivery is not configured',
    data,
  });
});

const verifyEmailChange = asyncHandler(async (req, res) => {
  const employee = await getEmployeeOrFail(req.params.id);
  const data = await emailChangeService.verifyEmailChange({
    employee,
    requestId: req.params.requestId,
    otp: req.body.otp,
    actor: req.user,
    req,
  });
  res.json({ success: true, message: 'Email address updated', data });
});

module.exports = {
  list,
  options,
  me,
  getOne,
  create,
  update,
  updateMe,
  setStatus,
  addTask,
  updateTask,
  offboard,
  remove,
  permanentDelete,
  emailHistory,
  requestEmailChange,
  verifyEmailChange,
};
