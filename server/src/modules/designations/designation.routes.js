const express = require('express');
const { z } = require('zod');
const Designation = require('../../models/Designation');
const Employee = require('../../models/Employee');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { logAudit } = require('../../utils/audit');
const { ROLES } = require('../../config/constants');

const router = express.Router();
router.use(protect);

const bodySchema = z.object({
  title: z.string().min(2).max(120),
  code: z.string().min(2).max(20),
  department: z.string().optional().or(z.literal('')),
  level: z.string().optional(),
  description: z.string().max(1000).optional(),
  minSalary: z.coerce.number().min(0).optional(),
  maxSalary: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.department) filter.department = req.query.department;
  if (req.query.search) filter.title = { $regex: req.query.search, $options: 'i' };
  if (!req.query.includeInactive) filter.isActive = true;
  const items = await Designation.find(filter).populate('department', 'name code').sort({ title: 1 }).lean();
  res.json({ success: true, data: items });
});

const create = asyncHandler(async (req, res) => {
  const payload = { ...req.body, code: req.body.code.toUpperCase() };
  if (!payload.department) delete payload.department;
  const exists = await Designation.findOne({ $or: [{ code: payload.code }, { title: payload.title, department: payload.department }] });
  if (exists) throw ApiError.conflict('A designation with this title or code already exists');
  const designation = await Designation.create(payload);
  await logAudit({
    req,
    actor: req.user,
    action: 'DESIGNATION_CREATED',
    module: 'DESIGNATION',
    entityType: 'Designation',
    entityId: designation._id,
    description: `Created designation ${designation.title}`,
    newValue: payload,
  });
  res.status(201).json({ success: true, message: 'Designation created', data: designation });
});

const update = asyncHandler(async (req, res) => {
  const designation = await Designation.findById(req.params.id);
  if (!designation) throw ApiError.notFound('Designation not found');
  const previous = designation.toObject();
  Object.assign(designation, req.body);
  if (req.body.code) designation.code = req.body.code.toUpperCase();
  if (req.body.department === '') designation.department = undefined;
  await designation.save();
  await logAudit({
    req,
    actor: req.user,
    action: 'DESIGNATION_UPDATED',
    module: 'DESIGNATION',
    entityType: 'Designation',
    entityId: designation._id,
    description: `Updated designation ${designation.title}`,
    previousValue: previous,
    newValue: req.body,
  });
  res.json({ success: true, message: 'Designation updated', data: designation });
});

const remove = asyncHandler(async (req, res) => {
  const designation = await Designation.findById(req.params.id);
  if (!designation) throw ApiError.notFound('Designation not found');
  const employees = await Employee.countDocuments({ designation: designation._id, isDeleted: false });
  if (employees > 0) throw ApiError.badRequest('Cannot remove a designation that is assigned to employees');
  designation.isActive = false;
  await designation.save();
  await logAudit({
    req,
    actor: req.user,
    action: 'DESIGNATION_DEACTIVATED',
    module: 'DESIGNATION',
    entityType: 'Designation',
    entityId: designation._id,
    description: `Deactivated designation ${designation.title}`,
  });
  res.json({ success: true, message: 'Designation deactivated' });
});

router.get('/', list);
router.post('/', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR), validate({ body: bodySchema }), create);
router.patch('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR), validate({ body: bodySchema.partial() }), update);
router.delete('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), remove);

module.exports = router;
