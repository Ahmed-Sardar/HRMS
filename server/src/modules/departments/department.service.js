const Department = require('../../models/Department');
const Employee = require('../../models/Employee');
const Designation = require('../../models/Designation');
const ApiError = require('../../utils/ApiError');
const { getPagination, paginatedResponse } = require('../../utils/pagination');
const { logAudit } = require('../../utils/audit');

const listDepartments = async (query) => {
  const pagination = getPagination({ ...query, limit: query.limit || 100 });
  const filter = {};
  if (query.search) filter.$or = [{ name: { $regex: query.search, $options: 'i' } }, { code: { $regex: query.search, $options: 'i' } }];
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (!query.includeInactive) filter.isActive = query.isActive === 'false' ? false : true;

  const [items, total] = await Promise.all([
    Department.find(filter)
      .populate({ path: 'head', select: 'firstName lastName employeeId' })
      .sort({ name: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Department.countDocuments(filter),
  ]);

  const counts = await Employee.aggregate([
    { $match: { isDeleted: false, department: { $in: items.map((item) => item._id) } } },
    { $group: { _id: '$department', count: { $sum: 1 } } },
  ]);
  const countMap = counts.reduce((acc, item) => ({ ...acc, [String(item._id)]: item.count }), {});

  return paginatedResponse(
    items.map((item) => ({ ...item, employeeCount: countMap[String(item._id)] || 0 })),
    total,
    pagination,
  );
};

const createDepartment = async ({ payload, actor, req }) => {
  const exists = await Department.findOne({ $or: [{ name: payload.name }, { code: payload.code.toUpperCase() }] });
  if (exists) throw ApiError.conflict('A department with this name or code already exists');
  const department = await Department.create({ ...payload, code: payload.code.toUpperCase() });
  await logAudit({
    req,
    actor,
    action: 'DEPARTMENT_CREATED',
    module: 'DEPARTMENT',
    entityType: 'Department',
    entityId: department._id,
    description: `Created department ${department.name}`,
    newValue: payload,
  });
  return department;
};

const updateDepartment = async ({ id, payload, actor, req }) => {
  const department = await Department.findById(id);
  if (!department) throw ApiError.notFound('Department not found');
  const previous = department.toObject();
  Object.assign(department, payload);
  if (payload.code) department.code = payload.code.toUpperCase();
  await department.save();
  await logAudit({
    req,
    actor,
    action: 'DEPARTMENT_UPDATED',
    module: 'DEPARTMENT',
    entityType: 'Department',
    entityId: department._id,
    description: `Updated department ${department.name}`,
    previousValue: previous,
    newValue: payload,
  });
  return department;
};

const deleteDepartment = async ({ id, actor, req }) => {
  const department = await Department.findById(id);
  if (!department) throw ApiError.notFound('Department not found');
  const employees = await Employee.countDocuments({ department: id, isDeleted: false });
  if (employees > 0) {
    throw ApiError.badRequest(`Cannot remove a department with ${employees} active employee(s). Reassign them first.`);
  }
  department.isActive = false;
  await department.save();
  await Designation.updateMany({ department: id }, { isActive: false });
  await logAudit({
    req,
    actor,
    action: 'DEPARTMENT_DEACTIVATED',
    module: 'DEPARTMENT',
    entityType: 'Department',
    entityId: department._id,
    description: `Deactivated department ${department.name}`,
  });
  return { success: true };
};

module.exports = { listDepartments, createDepartment, updateDepartment, deleteDepartment };
