const Notification = require('../models/Notification');
const User = require('../models/User');
const Employee = require('../models/Employee');
const env = require('../config/env');
const logger = require('../utils/logger');
const { getSettings } = require('./settings.service');
const { sendNotificationEmail } = require('../utils/mail');

/**
 * Creates in-app notifications for one or many users.
 * payload: { users: [userId], employee?, title, message, type, link, priority, meta }
 */
const notifyUsers = async ({ users = [], employee, title, message, type = 'SYSTEM', link, priority = 'NORMAL', meta }) => {
  const unique = [...new Set(users.filter(Boolean).map(String))];
  if (!unique.length) return [];
  const docs = unique.map((userId) => ({
    user: userId,
    employee,
    title,
    message,
    type,
    link,
    priority,
    meta,
  }));
  const created = await Notification.insertMany(docs);

  try {
    const settings = await getSettings();
    if (settings.enableEmailNotifications && env.mail.host) {
      const recipients = await User.find({ _id: { $in: unique }, isActive: true }).select('email name');
      await Promise.all(
        recipients.map((user) =>
          sendNotificationEmail({
            to: user.email,
            name: user.name,
            title,
            message,
            link: link ? `${env.clientUrl}${link}` : env.clientUrl,
          }),
        ),
      );
      if (created.length) {
        await Notification.updateMany({ _id: { $in: created.map((item) => item._id) } }, { emailedAt: new Date() });
      }
    }
  } catch (error) {
    logger.error(`Notification email dispatch failed: ${error.message}`);
  }

  return created;
};

/** Notifies every active user holding one of the given roles. */
const notifyRoles = async (roles, payload) => {
  const users = await User.find({ role: { $in: roles }, isActive: true }).select('_id');
  return notifyUsers({ ...payload, users: users.map((user) => user._id) });
};

/** Notifies the user account behind an employee record. */
const notifyEmployee = async (employeeId, payload) => {
  const employee = await Employee.findById(employeeId).select('user firstName lastName email');
  if (!employee || !employee.user) return [];
  return notifyUsers({ ...payload, users: [employee.user], employee: employee._id });
};

module.exports = { notifyUsers, notifyRoles, notifyEmployee };
