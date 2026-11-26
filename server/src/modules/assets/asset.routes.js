const express = require('express');
const { z } = require('zod');
const CompanyAsset = require('../../models/CompanyAsset');
const Employee = require('../../models/Employee');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { logAudit } = require('../../utils/audit');
const { getPagination, paginatedResponse } = require('../../utils/pagination');
const { notifyEmployee } = require('../../services/notification.service');
const { ROLES, ASSET_STATUS } = require('../../config/constants');
const time = require('../../utils/time');

const router = express.Router();
router.use(protect);

const managerRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR];
const assetBody = z.object({
  assetTag: z.string().min(2).max(40),
  name: z.string().min(2).max(200),
  category: z.enum(['LAPTOP', 'DESKTOP', 'MONITOR', 'MOBILE', 'ACCESS_CARD', 'FURNITURE', 'OTHER']),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.coerce.date().optional(),
  purchaseCost: z.coerce.number().min(0).optional(),
  warrantyExpiry: z.coerce.date().optional(),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE']).optional(),
  status: z.enum(Object.values(ASSET_STATUS)).optional(),
  notes: z.string().optional(),
});

router.get(
  '/',
  authorize(...managerRoles, ROLES.FINANCE),
  asyncHandler(async (req, res) => {
    const pagination = getPagination(req.query);
    const filter = { isDeleted: false };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { assetTag: { $regex: req.query.search, $options: 'i' } },
        { serialNumber: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    const [items, total] = await Promise.all([
      CompanyAsset.find(filter)
        .populate('assignedTo', 'employeeId firstName lastName')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      CompanyAsset.countDocuments(filter),
    ]);
    const counts = await CompanyAsset.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    res.json({
      success: true,
      data: {
        ...paginatedResponse(items, total, pagination),
        counts: counts.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      },
    });
  }),
);

router.get('/my', asyncHandler(async (req, res) => {
  if (!req.user.employee) throw ApiError.unauthorized();
  const assets = await CompanyAsset.find({ assignedTo: req.user.employee, isDeleted: false }).lean();
  res.json({ success: true, data: assets });
}));

router.post('/', authorize(...managerRoles), validate({ body: assetBody }), asyncHandler(async (req, res) => {
  const payload = { ...req.body, assetTag: req.body.assetTag.toUpperCase() };
  const exists = await CompanyAsset.findOne({ assetTag: payload.assetTag });
  if (exists) throw ApiError.conflict('An asset with this tag already exists');
  const asset = await CompanyAsset.create({
    ...payload,
    history: [{ action: 'CREATED', at: new Date(), by: req.user._id }],
  });
  await logAudit({
    req,
    actor: req.user,
    action: 'ASSET_CREATED',
    module: 'ASSET',
    entityType: 'CompanyAsset',
    entityId: asset._id,
    description: `Created asset ${asset.name} (${asset.assetTag})`,
    newValue: payload,
  });
  res.status(201).json({ success: true, message: 'Asset created', data: asset });
}));

router.get('/:id', authorize(...managerRoles, ROLES.FINANCE), asyncHandler(async (req, res) => {
  const asset = await CompanyAsset.findOne({ _id: req.params.id, isDeleted: false })
    .populate('assignedTo', 'employeeId firstName lastName department')
    .populate('history.employee', 'employeeId firstName lastName')
    .populate('history.by', 'name');
  if (!asset) throw ApiError.notFound('Asset not found');
  res.json({ success: true, data: asset });
}));

router.patch(
  '/:id',
  authorize(...managerRoles),
  validate({ body: assetBody.partial() }),
  asyncHandler(async (req, res) => {
    const asset = await CompanyAsset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) throw ApiError.notFound('Asset not found');
    const previous = asset.toObject();
    Object.assign(asset, req.body);
    if (req.body.assetTag) asset.assetTag = req.body.assetTag.toUpperCase();
    await asset.save();
    await logAudit({
      req,
      actor: req.user,
      action: 'ASSET_UPDATED',
      module: 'ASSET',
      entityType: 'CompanyAsset',
      entityId: asset._id,
      description: `Updated asset ${asset.name} (${asset.assetTag})`,
      previousValue: { status: previous.status, condition: previous.condition },
      newValue: req.body,
    });
    res.json({ success: true, message: 'Asset updated', data: asset });
  }),
);

router.post(
  '/:id/assign',
  authorize(...managerRoles),
  validate({
    body: z.object({
      employee: z.string().min(1),
      expectedReturnDate: z.coerce.date().optional(),
      condition: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE']).optional(),
      notes: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const asset = await CompanyAsset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) throw ApiError.notFound('Asset not found');
    if (asset.status === ASSET_STATUS.ASSIGNED) throw ApiError.conflict('This asset is already assigned');
    const employee = await Employee.findOne({ _id: req.body.employee, isDeleted: false });
    if (!employee) throw ApiError.notFound('Employee not found');

    asset.status = ASSET_STATUS.ASSIGNED;
    asset.assignedTo = employee._id;
    asset.assignedAt = new Date();
    asset.assignedBy = req.user._id;
    asset.expectedReturnDate = req.body.expectedReturnDate;
    if (req.body.condition) asset.condition = req.body.condition;
    asset.history.push({
      action: 'ASSIGNED',
      employee: employee._id,
      at: new Date(),
      by: req.user._id,
      condition: req.body.condition,
      notes: req.body.notes,
    });
    await asset.save();

    await notifyEmployee(employee._id, {
      title: 'Company asset assigned',
      message: `${asset.name} (${asset.assetTag}) has been assigned to you.`,
      type: 'ASSET',
      link: '/assets',
    });

    await logAudit({
      req,
      actor: req.user,
      action: 'ASSET_ASSIGNED',
      module: 'ASSET',
      entityType: 'CompanyAsset',
      entityId: asset._id,
      description: `Assigned asset ${asset.assetTag} to ${employee.fullName}`,
      newValue: { employee: employee.employeeId },
    });

    res.json({ success: true, message: 'Asset assigned', data: asset });
  }),
);

router.post(
  '/:id/return',
  authorize(...managerRoles),
  validate({
    body: z.object({
      condition: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE']),
      notes: z.string().optional(),
      status: z.enum(['AVAILABLE', 'IN_REPAIR', 'RETIRED']).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const asset = await CompanyAsset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) throw ApiError.notFound('Asset not found');
    if (asset.status !== ASSET_STATUS.ASSIGNED) throw ApiError.badRequest('This asset is not currently assigned');

    const previousEmployee = asset.assignedTo;
    asset.history.push({
      action: 'RETURNED',
      employee: previousEmployee,
      at: new Date(),
      by: req.user._id,
      condition: req.body.condition,
      notes: req.body.notes,
    });
    asset.status = req.body.status || (req.body.condition === 'DAMAGED' ? ASSET_STATUS.IN_REPAIR : ASSET_STATUS.AVAILABLE);
    asset.condition = req.body.condition;
    asset.returnCondition = req.body.condition;
    asset.returnedAt = new Date();
    asset.assignedTo = undefined;
    asset.assignedAt = undefined;
    asset.expectedReturnDate = undefined;
    await asset.save();

    await logAudit({
      req,
      actor: req.user,
      action: 'ASSET_RETURNED',
      module: 'ASSET',
      entityType: 'CompanyAsset',
      entityId: asset._id,
      description: `Asset ${asset.assetTag} returned in ${req.body.condition} condition`,
      newValue: { condition: req.body.condition, status: asset.status },
    });

    res.json({ success: true, message: 'Asset returned', data: asset });
  }),
);

router.delete('/:id', authorize(...managerRoles), asyncHandler(async (req, res) => {
  const asset = await CompanyAsset.findOne({ _id: req.params.id, isDeleted: false });
  if (!asset) throw ApiError.notFound('Asset not found');
  if (asset.status === ASSET_STATUS.ASSIGNED) {
    throw ApiError.badRequest('Return the asset before removing it');
  }
  asset.isDeleted = true;
  asset.status = ASSET_STATUS.RETIRED;
  await asset.save();
  await logAudit({
    req,
    actor: req.user,
    action: 'ASSET_RETIRED',
    module: 'ASSET',
    entityType: 'CompanyAsset',
    entityId: asset._id,
    description: `Retired asset ${asset.assetTag}`,
  });
  res.json({ success: true, message: 'Asset retired' });
}));

void time;
module.exports = router;
