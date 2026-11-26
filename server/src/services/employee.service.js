const Employee = require('../models/Employee');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const generateEmployeeId = async () => {
  const year = new Date().getFullYear();
  const prefix = `EMP${year}`;
  const last = await Employee.findOne({ employeeId: new RegExp(`^${prefix}`) })
    .sort({ employeeId: -1 })
    .select('employeeId');
  const lastSequence = last ? Number.parseInt(last.employeeId.replace(prefix, ''), 10) || 0 : 0;
  return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`;
};

const getEmployeeOrFail = async (id, { populate = true } = {}) => {
  let query = Employee.findOne({ _id: id, isDeleted: false });
  if (populate) {
    query = query
      .populate('department', 'name code')
      .populate('designation', 'title code')
      .populate({ path: 'reportingManager', select: 'firstName lastName employeeId email' })
      .populate('shift', 'name startTime endTime');
  }
  const employee = await query;
  if (!employee) throw ApiError.notFound('Employee not found');
  return employee;
};

const getEmployeeForUser = async (user) => {
  if (!user) throw ApiError.unauthorized();
  const employee = await Employee.findOne({
    isDeleted: false,
    $or: [{ user: user._id }, ...(user.employee ? [{ _id: user.employee }] : [])],
  })
    .populate('department', 'name code')
    .populate('designation', 'title code')
    .populate({ path: 'reportingManager', select: 'firstName lastName employeeId email' })
    .populate('shift', 'name startTime endTime');
  if (!employee) throw ApiError.notFound('No employee profile is linked to your account');
  return employee;
};

/** Resolves a set of employee ids visible to a role (used for scoping queries). */
const scopeEmployeeIds = async ({ user, employee }) => {
  if (['SUPER_ADMIN', 'ADMIN', 'HR', 'FINANCE'].includes(user.role)) return null; // all
  if (!employee) return [];
  const reports = await Employee.find({ reportingManager: employee._id, isDeleted: false }).select('_id');
  return [employee._id, ...reports.map((item) => item._id)];
};

const syncUserRole = async (employeeId, role) => {
  const employee = await Employee.findById(employeeId);
  if (!employee || !employee.user) return null;
  return User.findByIdAndUpdate(employee.user, { role }, { new: true });
};

module.exports = {
  generateEmployeeId,
  getEmployeeOrFail,
  getEmployeeForUser,
  scopeEmployeeIds,
  syncUserRole,
};
