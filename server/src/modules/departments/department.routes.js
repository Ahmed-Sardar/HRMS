const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');
const service = require('./department.service');

const router = express.Router();
router.use(protect);

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(20),
  description: z.string().max(1000).optional(),
  head: z.string().optional().or(z.literal('')),
  parent: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await service.listDepartments(req.query);
    res.json({ success: true, data });
  }),
);

router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({ body: bodySchema }),
  asyncHandler(async (req, res) => {
    const data = await service.createDepartment({ payload: req.body, actor: req.user, req });
    res.status(201).json({ success: true, message: 'Department created', data });
  }),
);

router.patch(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({ body: bodySchema.partial() }),
  asyncHandler(async (req, res) => {
    const data = await service.updateDepartment({ id: req.params.id, payload: req.body, actor: req.user, req });
    res.json({ success: true, message: 'Department updated', data });
  }),
);

router.delete(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const data = await service.deleteDepartment({ id: req.params.id, actor: req.user, req });
    res.json({ success: true, message: 'Department deactivated', data });
  }),
);

module.exports = router;
