const asyncHandler = require('../../utils/asyncHandler');
const service = require('./attendance.service');

const checkIn = asyncHandler(async (req, res) => {
  const data = await service.checkIn({ user: req.user, employee: req.employee, req });
  res.json({ success: true, message: 'Checked in successfully', data });
});

const startBreak = asyncHandler(async (req, res) => {
  const data = await service.startBreak({ user: req.user, employee: req.employee, req, payload: req.body });
  res.json({ success: true, message: 'Break started', data });
});

const endBreak = asyncHandler(async (req, res) => {
  const data = await service.endBreak({ user: req.user, employee: req.employee, req });
  res.json({ success: true, message: 'Break ended', data });
});

const checkOut = asyncHandler(async (req, res) => {
  const data = await service.checkOut({ user: req.user, employee: req.employee, req });
  res.json({ success: true, message: 'Checked out successfully', data });
});

const today = asyncHandler(async (req, res) => {
  const data = await service.getToday(req.employee);
  res.json({ success: true, data });
});

const myAttendance = asyncHandler(async (req, res) => {
  const data = await service.getMyAttendance({ employee: req.employee, query: req.validatedQuery || req.query });
  res.json({ success: true, data });
});

const calendar = asyncHandler(async (req, res) => {
  const data = await service.getMonthCalendar({
    employee: req.employee,
    month: req.validatedQuery?.month || req.query.month,
    employeeId: req.query.employee,
    user: req.user,
  });
  res.json({ success: true, data });
});

const list = asyncHandler(async (req, res) => {
  const data = await service.listAttendance(req.validatedQuery || req.query);
  res.json({ success: true, data });
});

const orgSummary = asyncHandler(async (req, res) => {
  const data = await service.getOrgAttendanceSummary({
    date: req.query.date,
    department: req.query.department,
  });
  res.json({ success: true, data });
});

const requestCorrection = asyncHandler(async (req, res) => {
  const data = await service.requestCorrection({ user: req.user, employee: req.employee, payload: req.body, req });
  res.status(201).json({ success: true, message: 'Correction request submitted', data });
});

const corrections = asyncHandler(async (req, res) => {
  const data = await service.listCorrections({ query: req.validatedQuery || req.query, user: req.user });
  res.json({ success: true, data });
});

const reviewCorrection = asyncHandler(async (req, res) => {
  const data = await service.reviewCorrection({ id: req.params.id, user: req.user, payload: req.body, req });
  res.json({ success: true, message: `Correction ${req.body.status.toLowerCase()}`, data });
});

const correctAttendance = asyncHandler(async (req, res) => {
  const data = await service.correctAttendance({ id: req.params.id, user: req.user, payload: req.body, req });
  res.json({ success: true, message: 'Attendance updated', data });
});

const exportReport = asyncHandler(async (req, res) => {
  await service.exportAttendance({ query: req.query, res, user: req.user });
});

module.exports = {
  checkIn,
  startBreak,
  endBreak,
  checkOut,
  today,
  myAttendance,
  calendar,
  list,
  orgSummary,
  requestCorrection,
  corrections,
  reviewCorrection,
  correctAttendance,
  exportReport,
};
