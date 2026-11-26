const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { ROLES, LEAVE_STATUS } = require('../../config/constants');
const service = require('./leave.service');
const { getSettings } = require('../../services/settings.service');

const router = express.Router();
router.use(protect);

const applySchema = z.object({
  leaveType: z.string().min(2),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isHalfDay: z.boolean().optional(),
  halfDaySession: z.enum(['FIRST_HALF', 'SECOND_HALF']).optional(),
  reason: z.string().min(5, 'Please provide a reason').max(2000),
  contactDuringLeave: z.string().optional(),
  handoverTo: z.string().optional(),
});

const listQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(Object.values(LEAVE_STATUS)).optional(),
  leaveType: z.string().optional(),
  employee: z.string().optional(),
  department: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  year: z.coerce.number().optional(),
});

router.get(
  '/types',
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    res.json({ success: true, data: settings.leaveTypes });
  }),
);

router.get('/balance/my', asyncHandler(async (req, res) => {
  const data = await service.getMyBalances(req.employee);
  res.json({ success: true, data });
}));

router.get('/balance/:employeeId', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR), asyncHandler(async (req, res) => {
  const data = await service.getOrCreateBalance(req.params.employeeId, Number(req.query.year) || new Date().getFullYear());
  res.json({ success: true, data });
}));

router.get('/my', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const data = await service.listMyLeaves({ employee: req.employee, query: req.validatedQuery || req.query });
  res.json({ success: true, data });
}));

router.get('/calendar', asyncHandler(async (req, res) => {
  const data = await service.teamCalendar({ query: req.query, user: req.user });
  res.json({ success: true, data });
}));

router.get('/export', asyncHandler(async (req, res) => {
  await service.exportLeaves({ query: req.query, res, user: req.user });
}));

router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.FINANCE), validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const data = await service.listLeaves({ query: req.validatedQuery || req.query });
  res.json({ success: true, data });
}));

router.post('/', validate({ body: applySchema }), asyncHandler(async (req, res) => {
  const data = await service.applyLeave({ user: req.user, employee: req.employee, payload: req.body, req });
  res.status(201).json({ success: true, message: 'Leave request submitted', data });
}));

router.patch(
  '/:id/review',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({
    body: z.object({
      status: z.enum([LEAVE_STATUS.APPROVED, LEAVE_STATUS.REJECTED]),
      reviewComment: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.reviewLeave({ id: req.params.id, user: req.user, payload: req.body, req });
    res.json({ success: true, message: `Leave ${req.body.status.toLowerCase()}`, data });
  }),
);

router.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const data = await service.cancelLeave({ id: req.params.id, user: req.user, employee: req.employee, req });
  res.json({ success: true, message: 'Leave request cancelled', data });
}));

module.exports = router;
