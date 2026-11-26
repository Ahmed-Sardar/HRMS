const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { ROLES, EXIT_STATUS, EXIT_TYPE, CLEARANCE_DEPARTMENT } = require('../../config/constants');
const ExitRequest = require('../../models/ExitRequest');
const ApiError = require('../../utils/ApiError');
const service = require('./exit.service');

const router = express.Router();
router.use(protect);

const listQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(Object.values(EXIT_STATUS)).optional(),
  exitType: z.enum(Object.values(EXIT_TYPE)).optional(),
  employee: z.string().optional(),
  search: z.string().optional(),
  format: z.enum(['xlsx', 'csv', 'pdf']).optional(),
});

router.post(
  '/',
  validate({
    body: z.object({
      exitType: z.enum([EXIT_TYPE.RESIGNATION]).optional(),
      resignationDate: z.coerce.date().optional(),
      requestedLastWorkingDay: z.coerce.date().optional(),
      noticePeriodDays: z.coerce.number().min(0).max(365).optional(),
      reason: z.string().min(10, 'Please provide a resignation reason').max(2000),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.submitResignation({ user: req.user, employee: req.employee, payload: req.body, req });
    res.status(201).json({ success: true, message: 'Resignation submitted', data });
  }),
);

router.post(
  '/initiate',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({
    body: z.object({
      employee: z.string().min(1),
      exitType: z.enum([EXIT_TYPE.TERMINATION, EXIT_TYPE.RETIREMENT, EXIT_TYPE.ABSCONDING]).optional(),
      resignationDate: z.coerce.date().optional(),
      approvedLastWorkingDay: z.coerce.date(),
      noticePeriodDays: z.coerce.number().min(0).max(365).optional(),
      reason: z.string().min(10).max(2000),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.initiateExit({ user: req.user, payload: req.body, req });
    res.status(201).json({ success: true, message: 'Exit initiated', data });
  }),
);

router.get('/my', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const data = await service.listMine({ employee: req.employee, query: req.validatedQuery || req.query });
  res.json({ success: true, data });
}));

router.get(
  '/export',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.FINANCE),
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    await service.exportExits({ query: req.validatedQuery || req.query, res, user: req.user });
  }),
);

router.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const data = await service.listExits({ query: req.validatedQuery || req.query, user: req.user });
    res.json({ success: true, data });
  }),
);

router.get('/:id', asyncHandler(async (req, res) => {
  const data = await service.getExit({ id: req.params.id, user: req.user });
  res.json({ success: true, data });
}));

router.patch(
  '/:id/manager-review',
  validate({
    body: z.object({
      decision: z.enum(['APPROVED', 'REJECTED']),
      comment: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.managerReview({ id: req.params.id, user: req.user, payload: req.body, req });
    res.json({ success: true, message: `Resignation ${req.body.decision.toLowerCase()}`, data });
  }),
);

router.patch(
  '/:id/hr-review',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({
    body: z.object({
      decision: z.enum(['APPROVED', 'REJECTED']),
      approvedLastWorkingDay: z.coerce.date().optional(),
      comment: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.hrReview({ id: req.params.id, user: req.user, payload: req.body, req });
    res.json({ success: true, message: `Resignation ${req.body.decision.toLowerCase()}`, data });
  }),
);

router.patch('/:id/withdraw', asyncHandler(async (req, res) => {
  const data = await service.withdraw({ id: req.params.id, user: req.user, employee: req.employee, req });
  res.json({ success: true, message: 'Resignation withdrawn', data });
}));

router.patch(
  '/:id/clearance',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.FINANCE),
  validate({
    body: z.object({
      department: z.enum(Object.values(CLEARANCE_DEPARTMENT)),
      status: z.enum(['PENDING', 'CLEARED', 'NOT_REQUIRED']),
      remarks: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.updateClearance({ id: req.params.id, user: req.user, payload: req.body, req });
    res.json({ success: true, message: 'Clearance updated', data });
  }),
);

router.patch(
  '/:id/assets/:assetId',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({
    body: z.object({
      returned: z.boolean(),
      condition: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE']).optional(),
      remarks: z.string().max(500).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.updateAssetReturn({
      id: req.params.id,
      user: req.user,
      assetId: req.params.assetId,
      payload: req.body,
      req,
    });
    res.json({ success: true, message: 'Asset return updated', data });
  }),
);

router.patch(
  '/:id/interview',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({
    body: z.object({
      scheduledAt: z.coerce.date().optional(),
      done: z.boolean().optional(),
      feedback: z.string().max(3000).optional(),
      rating: z.coerce.number().min(1).max(5).optional(),
      wouldRecommend: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.updateInterview({ id: req.params.id, user: req.user, payload: req.body, req });
    res.json({ success: true, message: 'Exit interview updated', data });
  }),
);

router.get(
  '/:id/settlement/preview',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.FINANCE),
  asyncHandler(async (req, res) => {
    const request = await ExitRequest.findById(req.params.id);
    if (!request) throw ApiError.notFound('Exit request not found');
    const data = await service.computeSettlementPreview(request);
    res.json({ success: true, data });
  }),
);

router.post(
  '/:id/settlement',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.FINANCE),
  validate({
    body: z.object({
      leaveEncashmentDays: z.coerce.number().min(0).optional(),
      leaveEncashmentAmount: z.coerce.number().min(0).optional(),
      pendingSalary: z.coerce.number().min(0).optional(),
      bonus: z.coerce.number().min(0).optional(),
      otherDeductions: z.coerce.number().min(0).optional(),
      noticeRecovery: z.coerce.number().min(0).optional(),
      notes: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { request, preview } = await service.saveSettlement({ id: req.params.id, user: req.user, payload: req.body, req });
    res.json({ success: true, message: 'Settlement computed', data: { request, preview } });
  }),
);

router.patch(
  '/:id/settlement',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FINANCE),
  validate({
    body: z.object({
      status: z.enum(['APPROVED', 'SETTLED']).optional(),
      paidReference: z.string().max(200).optional(),
      notes: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.approveSettlement({ id: req.params.id, user: req.user, payload: req.body, req });
    res.json({ success: true, message: 'Settlement updated', data });
  }),
);

router.post(
  '/:id/complete',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({ body: z.object({ comment: z.string().max(1000).optional() }).optional() }),
  asyncHandler(async (req, res) => {
    const data = await service.completeExit({ id: req.params.id, user: req.user, payload: req.body, req });
    res.json({ success: true, message: 'Exit completed', data });
  }),
);

router.get(
  '/:id/letters/:type',
  validate({ params: z.object({ id: z.string(), type: z.enum(['RELIEVING', 'EXPERIENCE']) }) }),
  asyncHandler(async (req, res) => {
    await service.issueLetter({ id: req.params.id, user: req.user, type: req.params.type, res, req });
  }),
);

module.exports = router;
