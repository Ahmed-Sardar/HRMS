const mongoose = require('mongoose');
const Employee = require('../../models/Employee');
const User = require('../../models/User');
const Department = require('../../models/Department');
const Designation = require('../../models/Designation');
const LeaveBalance = require('../../models/LeaveBalance');
const CompanyAsset = require('../../models/CompanyAsset');
const ExpenseReimbursement = require('../../models/Reimbursement');
const ApiError = require('../../utils/ApiError');
const { ROLES, EMPLOYMENT_STATUS } = require('../../config/constants');
const { getPagination, getSort, paginatedResponse } = require('../../utils/pagination');
const { logAudit } = require('../../utils/audit');
const { generateEmployeeId, getEmployeeOrFail } = require('../../services/employee.service');
const { getSettings } = require('../../services/settings.service');
const { sendWelcomeEmail } = require('../../utils/mail');
const { notifyEmployee } = require('../../services/notification.service');
const {
  assertEmailAvailable,
  buildChanges,
  persistEmailChange,
  normalizeEmail,
  EMAIL_TYPES,
} = require('../../services/emailChange.service');
const { yearOf } = require('../../utils/time');

const SELF_EDITABLE_FIELDS = [
  'phone',
  'altPhone',
  'personalEmail',
  'address',
  'emergencyContact',
  'profilePhoto',
  'about',
  'skills',
  'dateOfBirth',
  'maritalStatus',
  'gender',
  'bankDetails',
];

const DEFAULT_ONBOARDING_TASKS = [
  { title: 'Submit signed offer letter', owner: 'EMPLOYEE' },
  { title: 'Upload identity and education documents', owner: 'EMPLOYEE' },
  { title: 'Collect IT assets (laptop, access card)', owner: 'ADMIN' },
  { title: 'Complete bank and payroll details', owner: 'EMPLOYEE' },
  { title: 'Acknowledge company policies', owner: 'HR' },
  { title: 'Assign reporting manager and team induction', owner: 'HR' },
];

const canViewBankDetails = (viewerRole, isSelf) =>
  ['SUPER_ADMIN', 'ADMIN', 'HR', 'FINANCE'].includes(viewerRole) || isSelf;

/** Removes fields the viewer is not authorized to see. */
const sanitizeEmployee = (employee, viewerRole, isSelf) => {
  const plain = typeof employee.toObject === 'function' ? employee.toObject({ virtuals: true }) : { ...employee };
  if (!canViewBankDetails(viewerRole, isSelf)) delete plain.bankDetails;
  if (!['SUPER_ADMIN', 'ADMIN', 'HR', 'FINANCE'].includes(viewerRole)) {
    delete plain.offboarding;
    delete plain.onboardingTasks;
  }
  return plain;
};

const ensureEmployeeForSelf = (user) => {
  if (user.role === ROLES.EMPLOYEE && !user.employee) {
    throw ApiError.notFound('No employee profile is linked to your account. Contact HR.');
  }
};

const generateTemporaryPassword = () => {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const pool = `${upper}${lower}${digits}`;
  let password = upper[Math.floor(Math.random() * upper.length)] + lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  for (let i = 0; i < 7; i += 1) password += pool[Math.floor(Math.random() * pool.length)];
  return password;
};

const buildFilter = ({ search, department, designation, status, employmentType, reportingManager, includeInactive }) => {
  const filter = { isDeleted: false };
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }
  if (department && mongoose.isValidObjectId(department)) filter.department = department;
  if (designation && mongoose.isValidObjectId(designation)) filter.designation = designation;
  if (employmentType) filter.employmentType = employmentType;
  if (reportingManager && mongoose.isValidObjectId(reportingManager)) filter.reportingManager = reportingManager;
  if (status) filter.employmentStatus = status;
  else if (includeInactive !== 'true') {
    filter.employmentStatus = {
      $in: [EMPLOYMENT_STATUS.ACTIVE, EMPLOYMENT_STATUS.PROBATION, EMPLOYMENT_STATUS.NOTICE_PERIOD],
    };
  }
  return filter;
};

const listEmployees = async (query, viewer) => {
  const pagination = getPagination(query);
  const filter = buildFilter(query);
  const [items, total] = await Promise.all([
    Employee.find(filter)
      .populate('department', 'name code')
      .populate('designation', 'title code')
      .populate({ path: 'reportingManager', select: 'firstName lastName employeeId' })
      .sort(getSort(query, { createdAt: -1 }))
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean({ virtuals: true }),
    Employee.countDocuments(filter),
  ]);
  return paginatedResponse(
    items.map((item) => sanitizeEmployee(item, viewer.role, false)),
    total,
    pagination,
  );
};

const employeeOptions = async (search) => {
  const filter = { isDeleted: false, employmentStatus: { $ne: EMPLOYMENT_STATUS.TERMINATED } };
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } },
    ];
  }
  const employees = await Employee.find(filter)
    .select('employeeId firstName lastName email department')
    .populate('department', 'name')
    .sort({ firstName: 1 })
    .limit(100)
    .lean({ virtuals: true });
  return employees.map((item) => ({
    value: item._id,
    label: `${item.firstName} ${item.lastName} (${item.employeeId})`,
    email: item.email,
    department: item.department?.name,
  }));
};

const getEmployeeDetail = async (id, viewer) => {
  const employee = await getEmployeeOrFail(id);
  const isSelf = viewer.employee && String(viewer.employee) === String(employee._id);
  const data = sanitizeEmployee(employee, viewer.role, isSelf);

  if (isSelf || ['SUPER_ADMIN', 'ADMIN', 'HR', 'FINANCE'].includes(viewer.role)) {
    const [leaveBalance, documents, assets, reimbursements] = await Promise.all([
      LeaveBalance.findOne({ employee: employee._id, year: yearOf() }).lean(),
      require('../../models/EmployeeDocument')
        .find({ employee: employee._id, isDeleted: false })
        .select('title category status expiryDate createdAt originalName fileName mimetype size')
        .sort({ createdAt: -1 })
        .lean(),
      CompanyAsset.find({ assignedTo: employee._id, isDeleted: false })
        .select('assetTag name category status condition assignedAt')
        .lean(),
      ExpenseReimbursement.find({ employee: employee._id })
        .select('title category amount status expenseDate')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);
    data.leaveBalance = leaveBalance;
    data.documents = documents;
    data.assets = assets;
    data.reimbursements = reimbursements;
  }
  return data;
};

const createEmployee = async ({ payload, actor, req }) => {
  const existingEmployee = await Employee.findOne({
    $or: [{ email: payload.email.toLowerCase() }, { employeeId: payload.employeeId || '__none__' }],
    isDeleted: false,
  });
  if (existingEmployee) throw ApiError.conflict('An employee with this email or employee ID already exists');

  const existingUser = await User.findOne({ email: payload.email.toLowerCase() });
  if (existingUser) throw ApiError.conflict('A user account with this email already exists');

  const [department, designation] = await Promise.all([
    payload.department ? Department.findById(payload.department) : null,
    payload.designation ? Designation.findById(payload.designation) : null,
  ]);
  if (payload.department && !department) throw ApiError.badRequest('Department not found');
  if (payload.designation && !designation) throw ApiError.badRequest('Designation not found');

  if (payload.reportingManager) {
    const manager = await Employee.findOne({ _id: payload.reportingManager, isDeleted: false });
    if (!manager) throw ApiError.badRequest('Reporting manager not found');
  }

  const employeeId = payload.employeeId || (await generateEmployeeId());
  const temporaryPassword = payload.password || generateTemporaryPassword();
  const role = payload.role || ROLES.EMPLOYEE;

  if (role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only a super admin can create a super admin');
  }

  const user = await User.create({
    name: `${payload.firstName} ${payload.lastName}`.trim(),
    email: payload.email,
    password: temporaryPassword,
    role,
    phone: payload.phone,
    isActive: true,
    mustChangePassword: true,
    createdBy: actor._id,
  });

  const employee = await Employee.create({
    employeeId,
    user: user._id,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    personalEmail: payload.personalEmail,
    phone: payload.phone,
    dateOfBirth: payload.dateOfBirth,
    gender: payload.gender,
    department: department ? department._id : undefined,
    designation: designation ? designation._id : undefined,
    reportingManager: payload.reportingManager,
    dateOfJoining: payload.dateOfJoining,
    employmentType: payload.employmentType,
    workLocation: payload.workLocation,
    employmentStatus: payload.employmentStatus || EMPLOYMENT_STATUS.ACTIVE,
    shift: payload.shift,
    address: payload.address,
    emergencyContact: payload.emergencyContact,
    bankDetails: payload.bankDetails,
    about: payload.about,
    skills: payload.skills,
    onboardingTasks:
      payload.onboardingTasks?.length
        ? payload.onboardingTasks
        : DEFAULT_ONBOARDING_TASKS.map((task) => ({ ...task, completed: false })),
  });

  user.employee = employee._id;
  user.name = employee.fullName;
  await user.save({ validateBeforeSave: false });

  const settings = await getSettings();
  await LeaveBalance.create({
    employee: employee._id,
    year: yearOf(payload.dateOfJoining || new Date()),
    balances: (settings.leaveTypes || []).map((type) => ({
      type: type.code,
      allocated: type.annualQuota || 0,
      used: 0,
      pending: 0,
      carriedForward: 0,
    })),
  });

  if (payload.sendWelcomeEmail !== false) {
    sendWelcomeEmail({
      to: employee.email,
      name: employee.fullName,
      employeeId,
      temporaryPassword,
    }).catch(() => {});
  }

  await logAudit({
    req,
    actor,
    action: 'EMPLOYEE_CREATED',
    module: 'EMPLOYEE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `Created employee ${employee.fullName} (${employeeId})`,
    newValue: { employeeId, email: employee.email, role },
  });

  const populated = await getEmployeeOrFail(employee._id);
  return {
    employee: sanitizeEmployee(populated, actor.role, true),
    credentials:
      payload.password || payload.sendCredentials === false ? undefined : { email: employee.email, temporaryPassword },
  };
};

const updateEmployee = async ({ id, payload, actor, req }) => {
  const employee = await Employee.findOne({ _id: id, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');

  let workEmail;
  if (payload.email !== undefined) {
    const email = normalizeEmail(payload.email);
    if (email !== employee.email) {
      const linkedUser = employee.user ? await User.findById(employee.user) : null;
      if (linkedUser?.role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
        throw ApiError.forbidden('Only a super admin can change a super admin login email');
      }
      workEmail = await assertEmailAvailable({ email, employee, emailType: EMAIL_TYPES.WORK });
    }
  }

  let personalEmail;
  if (payload.personalEmail !== undefined) {
    const email = normalizeEmail(payload.personalEmail);
    if (email !== (employee.personalEmail || '')) {
      personalEmail = email
        ? await assertEmailAvailable({ email, employee, emailType: EMAIL_TYPES.PERSONAL })
        : '';
    }
  }

  const editable = [
    'firstName',
    'lastName',
    'phone',
    'altPhone',
    'dateOfBirth',
    'gender',
    'maritalStatus',
    'profilePhoto',
    'department',
    'designation',
    'reportingManager',
    'dateOfJoining',
    'confirmationDate',
    'employmentType',
    'workLocation',
    'employmentStatus',
    'shift',
    'address',
    'emergencyContact',
    'bankDetails',
    'about',
    'skills',
  ];

  const previousValue = {};
  const newValue = {};
  editable.forEach((field) => {
    if (payload[field] !== undefined) {
      previousValue[field] = employee[field];
      employee[field] = payload[field];
      newValue[field] = payload[field];
    }
  });

  if (payload.reportingManager && String(payload.reportingManager) === String(employee._id)) {
    throw ApiError.badRequest('An employee cannot report to themselves');
  }

  const emailChanges = buildChanges({ employee, workEmail, personalEmail });
  if (emailChanges.length) {
    await persistEmailChange({ employee, changes: emailChanges, actor, req });
    emailChanges.forEach((change) => {
      const field = change.emailType === EMAIL_TYPES.WORK ? 'email' : 'personalEmail';
      previousValue[field] = change.previousEmail;
      newValue[field] = change.newEmail;
    });
  } else {
    await employee.save();
  }

  if (employee.user && (payload.firstName || payload.lastName)) {
    await User.findByIdAndUpdate(employee.user, { name: employee.fullName });
  }

  await logAudit({
    req,
    actor,
    action: 'EMPLOYEE_UPDATED',
    module: 'EMPLOYEE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `Updated employee ${employee.fullName} (${employee.employeeId})`,
    previousValue,
    newValue,
  });

  const populated = await getEmployeeOrFail(employee._id);
  const isSelf = actor.employee && String(actor.employee) === String(employee._id);
  return sanitizeEmployee(populated, actor.role, isSelf);
};

const updateSelf = async ({ user, payload, req }) => {
  if (!user.employee) throw ApiError.notFound('No employee profile linked to your account');
  const employee = await Employee.findOne({ _id: user.employee, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee profile not found');

  const disallowed = Object.keys(payload).filter((key) => !SELF_EDITABLE_FIELDS.includes(key));
  if (disallowed.length) {
    throw ApiError.forbidden(`You cannot update these fields yourself: ${disallowed.join(', ')}`);
  }

  const currentPersonalEmail = employee.personalEmail || '';
  let personalEmail;
  if (payload.personalEmail !== undefined) {
    const email = normalizeEmail(payload.personalEmail);
    if (email !== currentPersonalEmail) {
      personalEmail = email
        ? await assertEmailAvailable({ email, employee, emailType: EMAIL_TYPES.PERSONAL })
        : '';
    }
  }

  const previousValue = {};
  SELF_EDITABLE_FIELDS.forEach((field) => {
    if (field !== 'personalEmail' && payload[field] !== undefined) {
      previousValue[field] = employee[field];
      employee[field] = payload[field];
    }
  });

  if (personalEmail !== undefined) {
    previousValue.personalEmail = currentPersonalEmail;
    await persistEmailChange({
      employee,
      changes: [
        {
          emailType: EMAIL_TYPES.PERSONAL,
          previousEmail: currentPersonalEmail,
          newEmail: personalEmail,
        },
      ],
      actor: user,
      req,
    });
  } else {
    await employee.save();
  }

  await logAudit({
    req,
    actor: user,
    action: 'EMPLOYEE_SELF_UPDATED',
    module: 'EMPLOYEE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `${employee.fullName} updated their profile`,
    previousValue,
    newValue: payload,
  });
  return sanitizeEmployee(employee, user.role, true);
};

const setEmploymentStatus = async ({ id, status, actor, req, payload = {} }) => {
  const employee = await Employee.findOne({ _id: id, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');
  const previousStatus = employee.employmentStatus;
  employee.employmentStatus = status;
  if (status === EMPLOYMENT_STATUS.TERMINATED) {
    employee.dateOfExit = payload.dateOfExit || new Date();
    employee.offboarding = {
      ...(employee.offboarding || {}),
      lastWorkingDay: payload.dateOfExit || new Date(),
      reason: payload.reason || 'Termination',
    };
  }
  if (status === EMPLOYMENT_STATUS.NOTICE_PERIOD) {
    employee.offboarding = {
      ...(employee.offboarding || {}),
      lastWorkingDay: payload.dateOfExit || undefined,
      reason: payload.reason || 'Resignation',
    };
  }
  await employee.save();

  if ([EMPLOYMENT_STATUS.TERMINATED, EMPLOYMENT_STATUS.INACTIVE].includes(status) && employee.user) {
    await User.findByIdAndUpdate(employee.user, { isActive: false });
    const RefreshToken = require('../../models/RefreshToken');
    await RefreshToken.updateMany({ user: employee.user, revokedAt: null }, { revokedAt: new Date() });
  }

  await logAudit({
    req,
    actor,
    action: 'EMPLOYMENT_STATUS_CHANGED',
    module: 'EMPLOYEE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `Employment status of ${employee.fullName} changed to ${status}`,
    previousValue: { employmentStatus: previousStatus },
    newValue: { employmentStatus: status },
  });
  return sanitizeEmployee(await getEmployeeOrFail(employee._id), actor.role, false);
};

const addOnboardingTask = async ({ id, payload, actor, req }) => {
  const employee = await Employee.findOne({ _id: id, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');
  employee.onboardingTasks.push({ ...payload, completed: false });
  await employee.save();
  await logAudit({
    req,
    actor,
    action: 'ONBOARDING_TASK_ADDED',
    module: 'EMPLOYEE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `Added onboarding task '${payload.title}' for ${employee.fullName}`,
  });
  return employee.onboardingTasks;
};

const updateOnboardingTask = async ({ id, taskId, payload, actor, req }) => {
  const employee = await Employee.findOne({ _id: id, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');
  const task = employee.onboardingTasks.id(taskId);
  if (!task) throw ApiError.notFound('Onboarding task not found');

  if (payload.title !== undefined) task.title = payload.title;
  if (payload.description !== undefined) task.description = payload.description;
  if (payload.owner !== undefined) task.owner = payload.owner;
  if (payload.dueDate !== undefined) task.dueDate = payload.dueDate;
  if (payload.completed !== undefined) {
    task.completed = payload.completed;
    task.completedAt = payload.completed ? new Date() : undefined;
    task.completedBy = payload.completed ? actor._id : undefined;
  }
  await employee.save();

  await logAudit({
    req,
    actor,
    action: 'ONBOARDING_TASK_UPDATED',
    module: 'EMPLOYEE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `Updated onboarding task '${task.title}' for ${employee.fullName}`,
  });
  return employee.onboardingTasks;
};

const offboardEmployee = async ({ id, payload, actor, req }) => {
  const employee = await Employee.findOne({ _id: id, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');

  employee.employmentStatus = EMPLOYMENT_STATUS.TERMINATED;
  employee.dateOfExit = payload.lastWorkingDay || new Date();
  employee.offboarding = {
    lastWorkingDay: payload.lastWorkingDay || new Date(),
    reason: payload.reason,
    exitInterviewDone: Boolean(payload.exitInterviewDone),
    assetsReturned: Boolean(payload.assetsReturned),
  };
  await employee.save();

  if (employee.user) {
    await User.findByIdAndUpdate(employee.user, { isActive: false });
    const RefreshToken = require('../../models/RefreshToken');
    await RefreshToken.updateMany({ user: employee.user, revokedAt: null }, { revokedAt: new Date() });
  }

  const assets = await CompanyAsset.find({ assignedTo: employee._id, status: 'ASSIGNED' });
  await Promise.all(
    assets.map(async (asset) => {
      asset.history.push({
        action: 'RETURNED',
        employee: employee._id,
        by: actor._id,
        notes: 'Returned during offboarding',
      });
      asset.status = 'AVAILABLE';
      asset.assignedTo = undefined;
      asset.assignedAt = undefined;
      asset.returnedAt = new Date();
      await asset.save();
    }),
  );

  await notifyEmployee(employee._id, {
    title: 'Offboarding initiated',
    message: `Your last working day has been recorded as ${new Date(employee.dateOfExit).toLocaleDateString()}.`,
    type: 'HR',
  });

  await logAudit({
    req,
    actor,
    action: 'EMPLOYEE_OFFBOARDED',
    module: 'EMPLOYEE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `Offboarded employee ${employee.fullName} (${employee.employeeId})`,
    newValue: employee.offboarding,
  });
  return sanitizeEmployee(await getEmployeeOrFail(employee._id), actor.role, false);
};

const deactivateEmployee = async ({ id, actor, req }) => {
  const employee = await Employee.findOne({ _id: id, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');
  if (actor.employee && String(actor.employee) === String(employee._id)) {
    throw ApiError.badRequest('You cannot deactivate your own employee record');
  }
  employee.isDeleted = true;
  employee.deletedAt = new Date();
  employee.employmentStatus = EMPLOYMENT_STATUS.INACTIVE;
  await employee.save();
  if (employee.user) {
    await User.findByIdAndUpdate(employee.user, { isActive: false });
    const RefreshToken = require('../../models/RefreshToken');
    await RefreshToken.updateMany({ user: employee.user, revokedAt: null }, { revokedAt: new Date() });
  }
  await logAudit({
    req,
    actor,
    action: 'EMPLOYEE_DEACTIVATED',
    module: 'EMPLOYEE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `Deactivated employee ${employee.fullName} (${employee.employeeId})`,
  });
  return { success: true };
};

module.exports = {
  listEmployees,
  employeeOptions,
  getEmployeeDetail,
  createEmployee,
  updateEmployee,
  updateSelf,
  setEmploymentStatus,
  addOnboardingTask,
  updateOnboardingTask,
  offboardEmployee,
  deactivateEmployee,
  sanitizeEmployee,
};
