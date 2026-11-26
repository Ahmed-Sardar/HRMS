const express = require('express');
const { z } = require('zod');
const Ticket = require('../../models/Ticket');
const Employee = require('../../models/Employee');
const User = require('../../models/User');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { logAudit } = require('../../utils/audit');
const { getPagination, paginatedResponse } = require('../../utils/pagination');
const { notifyEmployee, notifyRoles, notifyUsers } = require('../../services/notification.service');
const { getSettings } = require('../../services/settings.service');
const { sendExport } = require('../../utils/exports');
const { ROLES, TICKET_STATUS, TICKET_CATEGORY, TICKET_PRIORITY } = require('../../config/constants');
const time = require('../../utils/time');

const router = express.Router();
router.use(protect);

const STAFF_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR];
const DUE_HOURS = { URGENT: 4, HIGH: 24, NORMAL: 48, LOW: 72 };

const isStaff = (user) => STAFF_ROLES.includes(user.role);

const generateTicketNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `HD${year}`;
  const last = await Ticket.findOne({ ticketNumber: new RegExp(`^${prefix}`) })
    .sort({ ticketNumber: -1 })
    .select('ticketNumber');
  const sequence = last ? Number.parseInt(last.ticketNumber.replace(prefix, ''), 10) || 0 : 0;
  return `${prefix}${String(sequence + 1).padStart(4, '0')}`;
};

const restrictToOwnerOrStaff = (user, ticket) => {
  const owner = user.employee && String(ticket.employee?._id || ticket.employee) === String(user.employee);
  const assignee = ticket.assignedTo && String(ticket.assignedTo._id || ticket.assignedTo) === String(user._id);
  if (!owner && !isStaff(user) && !assignee) {
    throw ApiError.forbidden('You are not allowed to access this ticket');
  }
};

const listQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(Object.values(TICKET_STATUS)).optional(),
  category: z.enum(Object.values(TICKET_CATEGORY)).optional(),
  priority: z.enum(Object.values(TICKET_PRIORITY)).optional(),
  assignedTo: z.string().optional(),
  employee: z.string().optional(),
  search: z.string().optional(),
  mine: z.enum(['true', 'false']).optional(),
  format: z.enum(['xlsx', 'csv', 'pdf']).optional(),
});

router.post(
  '/',
  validate({
    body: z.object({
      subject: z.string().min(5).max(200),
      description: z.string().min(10).max(5000),
      category: z.enum(Object.values(TICKET_CATEGORY)).optional(),
      priority: z.enum(Object.values(TICKET_PRIORITY)).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!req.employee) throw ApiError.badRequest('Your account has no employee profile. Contact HR.');
    const ticketNumber = await generateTicketNumber();
    const dueAt = new Date(Date.now() + (DUE_HOURS[req.body.priority || 'NORMAL'] || 48) * 3600 * 1000);

    const ticket = await Ticket.create({
      ticketNumber,
      employee: req.employee._id,
      subject: req.body.subject,
      description: req.body.description,
      category: req.body.category || 'HR',
      priority: req.body.priority || 'NORMAL',
      dueAt,
      history: [{ action: 'CREATED', by: req.user._id, to: TICKET_STATUS.OPEN }],
    });

    await notifyRoles(['HR', 'ADMIN'], {
      title: `New ${ticket.category} helpdesk ticket`,
      message: `${req.employee.fullName} raised "${ticket.subject}" (${ticket.ticketNumber}, ${ticket.priority} priority).`,
      type: 'HR',
      link: '/helpdesk',
    });

    await logAudit({
      req,
      actor: req.user,
      action: 'TICKET_CREATED',
      module: 'HELPDESK',
      entityType: 'Ticket',
      entityId: ticket._id,
      description: `Created helpdesk ticket ${ticket.ticketNumber} (${ticket.category})`,
      newValue: { subject: ticket.subject, priority: ticket.priority, category: ticket.category },
    });

    res.status(201).json({ success: true, message: 'Ticket created', data: ticket });
  }),
);

router.get('/my', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  if (!req.employee) throw ApiError.badRequest('Your account has no employee profile. Contact HR.');
  const pagination = getPagination(req.query);
  const filter = { employee: req.employee._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  const [items, total] = await Promise.all([
    Ticket.find(filter)
      .populate('assignedTo', 'name role')
      .select('-comments')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Ticket.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, pagination) });
}));

router.get('/stats', authorize(...STAFF_ROLES), asyncHandler(async (req, res) => {
  const [byStatus, byCategory, overdue, unassigned] = await Promise.all([
    Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    Ticket.countDocuments({
      status: { $nin: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] },
      dueAt: { $lt: new Date() },
    }),
    Ticket.countDocuments({ assignedTo: null, status: { $nin: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] } }),
  ]);
  res.json({
    success: true,
    data: {
      byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      byCategory: byCategory.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      overdue,
      unassigned,
    },
  });
}));

router.get('/export', authorize(...STAFF_ROLES), validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const filter = {};
  const settings = await getSettings();
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.priority) filter.priority = req.query.priority;

  const tickets = await Ticket.find(filter)
    .populate('employee', 'employeeId firstName lastName')
    .populate('assignedTo', 'name')
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  await sendExport(res, {
    format: req.query.format || 'xlsx',
    baseName: 'helpdesk-tickets',
    title: `${settings.companyName} - Helpdesk Tickets`,
    subtitle: `Status: ${req.query.status || 'All'} | Category: ${req.query.category || 'All'}`,
    meta: [{ label: 'Generated by', value: req.user.name }, { label: 'Tickets', value: tickets.length }],
    columns: [
      { header: 'Ticket', key: 'ticketNumber', width: 14 },
      { header: 'Employee', key: 'name', width: 22 },
      { header: 'Subject', key: 'subject', width: 32 },
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Assigned To', key: 'assigned', width: 18 },
      { header: 'Created', key: 'createdAt', width: 14 },
    ],
    rows: tickets.map((item) => ({
      ticketNumber: item.ticketNumber,
      name: item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
      subject: item.subject,
      category: item.category,
      priority: item.priority,
      status: item.status,
      assigned: item.assignedTo?.name || 'Unassigned',
      createdAt: time.formatDate(item.createdAt),
    })),
    summary: [
      { label: 'Open tickets', value: tickets.filter((item) => item.status === TICKET_STATUS.OPEN).length },
      { label: 'Resolved tickets', value: tickets.filter((item) => item.status === TICKET_STATUS.RESOLVED).length },
    ],
  });
}));

router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query);
  const filter = {};
  if (!isStaff(req.user)) {
    if (!req.user.employee) throw ApiError.badRequest('Your account has no employee profile. Contact HR.');
    filter.employee = req.user.employee;
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
  if (req.query.employee) filter.employee = req.query.employee;
  if (req.query.mine === 'true') filter.assignedTo = req.user._id;

  if (req.query.search) {
    const ids = await Employee.find({
      isDeleted: false,
      $or: [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { employeeId: { $regex: req.query.search, $options: 'i' } },
      ],
    }).select('_id');
    filter.$or = [
      { subject: { $regex: req.query.search, $options: 'i' } },
      { ticketNumber: { $regex: req.query.search, $options: 'i' } },
      { employee: { $in: ids.map((item) => item._id) } },
    ];
  }

  const [items, total] = await Promise.all([
    Ticket.find(filter)
      .populate({ path: 'employee', select: 'employeeId firstName lastName department', populate: { path: 'department', select: 'name' } })
      .populate('assignedTo', 'name role')
      .select('-comments')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Ticket.countDocuments(filter),
  ]);

  res.json({ success: true, data: paginatedResponse(items, total, pagination) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id)
    .populate({ path: 'employee', select: 'employeeId firstName lastName department designation', populate: [{ path: 'department', select: 'name' }, { path: 'designation', select: 'title' }] })
    .populate('assignedTo', 'name role email')
    .populate('comments.author', 'name role')
    .populate('resolvedBy', 'name');
  if (!ticket) throw ApiError.notFound('Ticket not found');
  restrictToOwnerOrStaff(req.user, ticket);
  res.json({ success: true, data: ticket });
}));

router.patch(
  '/:id/assign',
  authorize(...STAFF_ROLES),
  validate({ body: z.object({ assignedTo: z.string().min(1), note: z.string().max(500).optional() }) }),
  asyncHandler(async (req, res) => {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) throw ApiError.notFound('Ticket not found');
    const assignee = await User.findOne({ _id: req.body.assignedTo, isActive: true }).select('name role');
    if (!assignee) throw ApiError.notFound('Assignee not found');

    const previous = ticket.assignedTo;
    ticket.assignedTo = assignee._id;
    ticket.assignedAt = new Date();
    ticket.assignedBy = req.user._id;
    if (ticket.status === TICKET_STATUS.OPEN) ticket.status = TICKET_STATUS.IN_PROGRESS;
    ticket.history.push({ action: 'ASSIGNED', by: req.user._id, note: `Assigned to ${assignee.name}` });
    await ticket.save();

    await notifyUsers({
      users: [assignee._id],
      title: 'Helpdesk ticket assigned to you',
      message: `${ticket.ticketNumber}: ${ticket.subject}`,
      type: 'HR',
      link: `/helpdesk?ticket=${ticket._id}`,
    });
    await notifyEmployee(ticket.employee, {
      title: 'Your ticket is being worked on',
      message: `${ticket.ticketNumber} has been assigned to ${assignee.name}.`,
      type: 'HR',
      link: '/helpdesk',
    });

    await logAudit({
      req,
      actor: req.user,
      action: 'TICKET_ASSIGNED',
      module: 'HELPDESK',
      entityType: 'Ticket',
      entityId: ticket._id,
      description: `Assigned ticket ${ticket.ticketNumber} to ${assignee.name}`,
      previousValue: { assignedTo: previous },
      newValue: { assignedTo: assignee._id },
    });

    res.json({ success: true, message: 'Ticket assigned', data: ticket });
  }),
);

router.patch(
  '/:id/status',
  validate({
    body: z.object({
      status: z.enum(Object.values(TICKET_STATUS)),
      resolutionSummary: z.string().max(2000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) throw ApiError.notFound('Ticket not found');
    const owner = req.user.employee && String(ticket.employee) === String(req.user.employee);
    if (!isStaff(req.user) && !owner) throw ApiError.forbidden('You are not allowed to update this ticket');
    if (!isStaff(req.user) && ![TICKET_STATUS.CLOSED].includes(req.body.status)) {
      throw ApiError.forbidden('Employees can only close their own resolved tickets');
    }
    if (!isStaff(req.user) && ticket.status !== TICKET_STATUS.RESOLVED) {
      throw ApiError.badRequest('Only resolved tickets can be closed');
    }

    const previous = ticket.status;
    ticket.status = req.body.status;
    if (req.body.status === TICKET_STATUS.RESOLVED) {
      ticket.resolutionSummary = req.body.resolutionSummary || ticket.resolutionSummary;
      ticket.resolvedBy = req.user._id;
      ticket.resolvedAt = new Date();
    }
    if (req.body.status === TICKET_STATUS.CLOSED) ticket.closedAt = new Date();
    if (req.body.status === TICKET_STATUS.OPEN) {
      ticket.resolvedAt = undefined;
      ticket.closedAt = undefined;
    }
    ticket.history.push({ action: 'STATUS_CHANGED', by: req.user._id, from: previous, to: ticket.status });
    await ticket.save();

    await notifyEmployee(ticket.employee, {
      title: `Ticket ${ticket.ticketNumber} ${ticket.status.replace(/_/g, ' ').toLowerCase()}`,
      message: ticket.resolutionSummary
        ? `Resolution: ${ticket.resolutionSummary}`
        : `Your ticket "${ticket.subject}" is now ${ticket.status.replace(/_/g, ' ').toLowerCase()}.`,
      type: 'HR',
      link: '/helpdesk',
    });

    await logAudit({
      req,
      actor: req.user,
      action: `TICKET_${ticket.status}`,
      module: 'HELPDESK',
      entityType: 'Ticket',
      entityId: ticket._id,
      description: `Ticket ${ticket.ticketNumber} moved to ${ticket.status}`,
      previousValue: { status: previous },
      newValue: { status: ticket.status },
    });

    res.json({ success: true, message: 'Ticket updated', data: ticket });
  }),
);

router.post(
  '/:id/comments',
  validate({ body: z.object({ message: z.string().min(1).max(3000), isInternal: z.boolean().optional() }) }),
  asyncHandler(async (req, res) => {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) throw ApiError.notFound('Ticket not found');
    restrictToOwnerOrStaff(req.user, ticket);
    const isInternal = Boolean(req.body.isInternal) && isStaff(req.user);

    ticket.comments.push({
      author: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      message: req.body.message,
      isInternal,
    });
    ticket.history.push({ action: 'COMMENTED', by: req.user._id, note: isInternal ? 'Internal note' : 'Reply added' });
    await ticket.save();

    const ownerUser = await Employee.findById(ticket.employee).select('user');
    if (!isInternal) {
      if (isStaff(req.user) && ownerUser?.user) {
        await notifyUsers({
          users: [ownerUser.user],
          title: `Reply on ticket ${ticket.ticketNumber}`,
          message: req.body.message.slice(0, 200),
          type: 'HR',
          link: '/helpdesk',
        });
      } else if (!isStaff(req.user) && ticket.assignedTo) {
        await notifyUsers({
          users: [ticket.assignedTo],
          title: `Employee replied on ${ticket.ticketNumber}`,
          message: req.body.message.slice(0, 200),
          type: 'HR',
          link: '/helpdesk',
        });
      }
    }

    const populated = await Ticket.findById(ticket._id)
      .populate('comments.author', 'name role')
      .populate('assignedTo', 'name role');
    res.status(201).json({ success: true, message: 'Comment added', data: populated });
  }),
);

module.exports = router;
