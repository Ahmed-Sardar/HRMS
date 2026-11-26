const CompanySettings = require('../models/CompanySettings');

let cache = { value: null, at: 0 };
const CACHE_MS = 30 * 1000;

const getSettings = async (force = false) => {
  if (!force && cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
  let settings = await CompanySettings.findOne({ key: 'company' });
  if (!settings) {
    settings = await CompanySettings.create({ key: 'company' });
  }
  cache = { value: settings, at: Date.now() };
  return settings;
};

const updateSettings = async (payload) => {
  const settings = await getSettings();
  const allowed = [
    'companyName',
    'legalName',
    'email',
    'phone',
    'website',
    'address',
    'logo',
    'timezone',
    'currency',
    'currencySymbol',
    'workingDays',
    'workStartTime',
    'workEndTime',
    'gracePeriodMinutes',
    'fullDayMinutes',
    'halfDayMinutes',
    'overtimeMultiplier',
    'weekendOvertimeMultiplier',
    'payrollDay',
    'probationMonths',
    'noticePeriodDays',
    'fiscalYearStartMonth',
    'attendanceCorrectionWindowDays',
    'wfhMonthlyLimit',
    'wfhRequiresHrApproval',
    'wfhMaxAdvanceDays',
    'wfhPolicyNotes',
    'enableEmailNotifications',
    'leaveTypes',
  ];
  allowed.forEach((key) => {
    if (payload[key] !== undefined) settings[key] = payload[key];
  });
  if (payload.statutory) {
    const current = settings.statutory?.toObject ? settings.statutory.toObject() : settings.statutory || {};
    settings.statutory = { ...current, ...payload.statutory };
  }
  await settings.save();
  cache = { value: settings, at: Date.now() };
  return settings;
};

const invalidateSettingsCache = () => {
  cache = { value: null, at: 0 };
};

module.exports = { getSettings, updateSettings, invalidateSettingsCache };
