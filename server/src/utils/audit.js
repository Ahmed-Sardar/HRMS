const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

/**
 * Writes an audit trail entry. Failures are logged but never break the request,
 * because audit persistence must not roll back a completed business action.
 */
const logAudit = async ({
  req,
  actor,
  action,
  module,
  entityType,
  entityId,
  description,
  previousValue,
  newValue,
  statusCode,
}) => {
  try {
    const user = actor || (req && req.user);
    await AuditLog.create({
      actor: user ? user._id : undefined,
      actorName: user ? user.name : 'System',
      actorRole: user ? user.role : 'SYSTEM',
      action,
      module: module || 'SYSTEM',
      entityType,
      entityId,
      description,
      previousValue,
      newValue,
      ipAddress: req ? req.ip : undefined,
      userAgent: req ? req.get('user-agent') : undefined,
      method: req ? req.method : undefined,
      path: req ? req.originalUrl : undefined,
      statusCode,
    });
  } catch (error) {
    logger.error(`Failed to write audit log: ${error.message}`);
  }
};

module.exports = { logAudit };
