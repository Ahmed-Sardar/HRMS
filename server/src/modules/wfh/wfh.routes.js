const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { ROLES, WFH_STATUS, WFH_WORK_MODE } = require('../../config/constants');
const service = require('./wfh.service');

const router = express.Router();
router.use(protect);

const applySchema = z.object({
  workMode: z.enum(Object.values(WFH_WORK_MODE)).optional(),
  dayType: z.enum(['FULL_DAY', 'HALF_DAY']).optional(),
  halfDaySession: z.enum(['FIRST_HALF', 'SECOND_HALF']).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().min(5, 'Please provide a reason').max(2000),
  workLocation: z.string().max(200).optional(),
  contactNumber: z.string().max(30).optional(),
  handoverTo: z.string().optional(),
});

const listQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(Object.values(WFH_STATUS)).optional(),
  employee: z.string().optional(),
  department: z.string().optional(),
  workMode: z.enum(Object.values(WFH_WORK_MODE)).optional(),
  month: z.string().optional(),
  search: z.string().optional(),
  format: z.enum(['xlsx', 'csv', 'pdf']).optional(),
});

router.get(
  '/policy',
  asyncHandler(async (req, res) => {
    const data = await service.getPolicy(req.employee);
    res.json({ success: true, data });
  }),
);

router.get('/my', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const data = await service.listMyWfh({ employee: req.employee, query: req.validatedQuery || req.query });
  res.json({ success: true, data });
}));

router.get('/calendar', asyncHandler(async (req, res) => {
  const data = await service.teamCalendar({ query: req.query, user: req.user, employee: req.employee });
  res.json({ success: true, data });
}));

router.get('/summary', asyncHandler(async (req, res) => {
  const data = await service.getPendingSummary();
  res.json({ success: true, data });
}));

router.get('/export', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  await service.exportWfh({ query: req.validatedQuery || req.query, res, user: req.user });
}));

router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const data = await service.listWfh({ query: req.validatedQuery || req.query, user: req.user });
  res.json({ success: true, data });
}));

router.post('/', validate({ body: applySchema }), asyncHandler(async (req, res) => {
  const data = await service.applyWfh({ user: req.user, employee: req.employee, payload: req.body, req });
  res.status(201).json({ success: true, message: 'Work-from-home request submitted', data });
}));

router.patch(
  '/:id/review',
  validate({
    body: z.object({
      status: z.enum([WFH_STATUS.MANAGER_APPROVED, WFH_STATUS.APPROVED, WFH_STATUS.REJECTED]),
      reviewComment: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const payload = {
      status: req.body.status === WFH_STATUS.REJECTED ? WFH_STATUS.REJECTED : WFH_STATUS.APPROVED,
      reviewComment: req.body.reviewComment,
    };
    const data = await service.reviewWfh({ id: req.params.id, user: req.user, payload, req });
    res.json({ success: true, message: `Work-from-home request ${payload.status.toLowerCase()}`, data });
  }),
);

router.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const data = await service.cancelWfh({ id: req.params.id, user: req.user, employee: req.employee, req });
  res.json({ success: true, message: 'Work-from-home request cancelled', data });
}));

module.exports = router;
