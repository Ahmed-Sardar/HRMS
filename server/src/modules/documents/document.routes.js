const express = require('express');
const path = require('path');
const { z } = require('zod');
const EmployeeDocument = require('../../models/EmployeeDocument');
const Employee = require('../../models/Employee');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const env = require('../../config/env');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { uploadDocument, toStoredFile, deleteStoredFile } = require('../../middleware/upload');
const { logAudit } = require('../../utils/audit');
const { getPagination, paginatedResponse } = require('../../utils/pagination');
const { ROLES, DOCUMENT_STATUS } = require('../../config/constants');
const { notifyEmployee } = require('../../services/notification.service');

const router = express.Router();
router.use(protect);

const staffRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR];

const canAccessEmployeeDocs = (user, employeeId) =>
  staffRoles.includes(user.role) || (user.employee && String(user.employee) === String(employeeId));

router.get('/', asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query);
  const filter = { isDeleted: false };
  if (staffRoles.includes(req.user.role)) {
    if (req.query.employee) filter.employee = req.query.employee;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) filter.title = { $regex: req.query.search, $options: 'i' };
  } else {
    if (!req.user.employee) throw ApiError.unauthorized();
    filter.employee = req.user.employee;
    if (req.query.category) filter.category = req.query.category;
  }

  const [items, total] = await Promise.all([
    EmployeeDocument.find(filter)
      .populate({ path: 'employee', select: 'employeeId firstName lastName department', populate: { path: 'department', select: 'name' } })
      .populate('verifiedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .select('-path')
      .lean(),
    EmployeeDocument.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, pagination) });
}));

router.get('/expiring', authorize(...staffRoles), asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 60;
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);
  const documents = await EmployeeDocument.find({
    isDeleted: false,
    expiryDate: { $ne: null, $lte: threshold },
  })
    .populate('employee', 'employeeId firstName lastName')
    .sort({ expiryDate: 1 })
    .lean();
  res.json({ success: true, data: documents });
}));

router.post(
  '/',
  uploadDocument.single('file'),
  validate({
    body: z.object({
      employee: z.string().optional(),
      title: z.string().min(2).max(200),
      category: z.enum([
        'RESUME',
        'IDENTITY',
        'EDUCATION',
        'EMPLOYMENT',
        'OFFER_LETTER',
        'APPOINTMENT_LETTER',
        'EXPERIENCE_LETTER',
        'PAYSLIP',
        'OTHER',
      ]),
      issueDate: z.coerce.date().optional(),
      expiryDate: z.coerce.date().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('A document file is required');
    const targetEmployeeId = staffRoles.includes(req.user.role) && req.body.employee
      ? req.body.employee
      : req.user.employee;
    if (!targetEmployeeId) throw ApiError.badRequest('No employee profile is linked to your account');

    const employee = await Employee.findOne({ _id: targetEmployeeId, isDeleted: false });
    if (!employee) throw ApiError.notFound('Employee not found');

    const stored = toStoredFile(req.file, 'documents');
    const document = await EmployeeDocument.create({
      employee: targetEmployeeId,
      title: req.body.title,
      category: req.body.category,
      issueDate: req.body.issueDate,
      expiryDate: req.body.expiryDate,
      ...stored,
      uploadedBy: req.user._id,
    });

    if (staffRoles.includes(req.user.role) && String(targetEmployeeId) !== String(req.user.employee)) {
      await notifyEmployee(targetEmployeeId, {
        title: 'New document added to your profile',
        message: `${document.title} was uploaded by HR.`,
        type: 'DOCUMENT',
        link: '/documents',
      });
    }

    await logAudit({
      req,
      actor: req.user,
      action: 'DOCUMENT_UPLOADED',
      module: 'DOCUMENT',
      entityType: 'EmployeeDocument',
      entityId: document._id,
      description: `Uploaded ${document.category} document '${document.title}' for ${employee.fullName}`,
      newValue: { title: document.title, category: document.category, size: document.size },
    });

    res.status(201).json({ success: true, message: 'Document uploaded', data: document });
  }),
);

router.get('/:id/download', asyncHandler(async (req, res) => {
  const document = await EmployeeDocument.findOne({ _id: req.params.id, isDeleted: false }).populate('employee', 'firstName lastName employeeId');
  if (!document) throw ApiError.notFound('Document not found');
  if (!canAccessEmployeeDocs(req.user, document.employee._id)) {
    throw ApiError.forbidden('You are not allowed to download this document');
  }
  const absolute = path.resolve(env.uploadsRoot, document.path);
  if (!absolute.startsWith(path.resolve(env.uploadsRoot))) throw ApiError.forbidden('Invalid document path');

  document.downloadCount += 1;
  await document.save();

  await logAudit({
    req,
    actor: req.user,
    action: 'DOCUMENT_DOWNLOADED',
    module: 'DOCUMENT',
    entityType: 'EmployeeDocument',
    entityId: document._id,
    description: `Downloaded document '${document.title}' of ${document.employee?.firstName || ''} ${document.employee?.lastName || ''}`,
  });

  res.download(absolute, document.originalName);
}));

router.patch(
  '/:id/verify',
  authorize(...staffRoles),
  validate({
    body: z.object({
      status: z.enum([DOCUMENT_STATUS.VERIFIED, DOCUMENT_STATUS.REJECTED]),
      verificationComment: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const document = await EmployeeDocument.findOne({ _id: req.params.id, isDeleted: false });
    if (!document) throw ApiError.notFound('Document not found');
    document.status = req.body.status;
    document.verifiedBy = req.user._id;
    document.verifiedAt = new Date();
    document.verificationComment = req.body.verificationComment;
    await document.save();

    await notifyEmployee(document.employee, {
      title: `Document ${req.body.status.toLowerCase()}`,
      message: `Your document '${document.title}' was ${req.body.status.toLowerCase()} by HR.`,
      type: 'DOCUMENT',
      link: '/documents',
    });

    await logAudit({
      req,
      actor: req.user,
      action: `DOCUMENT_${req.body.status}`,
      module: 'DOCUMENT',
      entityType: 'EmployeeDocument',
      entityId: document._id,
      description: `Document '${document.title}' marked ${req.body.status.toLowerCase()}`,
      newValue: { status: req.body.status, comment: req.body.verificationComment },
    });

    res.json({ success: true, message: 'Document verification updated', data: document });
  }),
);

router.delete('/:id', asyncHandler(async (req, res) => {
  const document = await EmployeeDocument.findOne({ _id: req.params.id, isDeleted: false });
  if (!document) throw ApiError.notFound('Document not found');
  const isOwner = req.user.employee && String(document.employee) === String(req.user.employee);
  if (!staffRoles.includes(req.user.role) && !isOwner) {
    throw ApiError.forbidden('You can only delete your own documents');
  }
  if (isOwner && !staffRoles.includes(req.user.role) && document.status === DOCUMENT_STATUS.VERIFIED) {
    throw ApiError.badRequest('Verified documents cannot be deleted. Contact HR.');
  }
  document.isDeleted = true;
  await document.save();
  deleteStoredFile(document.path);

  await logAudit({
    req,
    actor: req.user,
    action: 'DOCUMENT_DELETED',
    module: 'DOCUMENT',
    entityType: 'EmployeeDocument',
    entityId: document._id,
    description: `Deleted document '${document.title}'`,
  });

  res.json({ success: true, message: 'Document deleted' });
}));

module.exports = router;
