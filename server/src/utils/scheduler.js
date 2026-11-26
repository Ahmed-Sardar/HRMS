const AutomationRun = require('../models/AutomationRun');
const logger = require('./logger');
const time = require('./time');
const {
  JOBS,
  initializeLeaveBalances,
  runReminders,
  markAutoAbsent,
} = require('../modules/automation/automation.service');

const TICK_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
let timer = null;
let running = false;

const isDisabled = () => String(process.env.DISABLE_AUTOMATION || '').toLowerCase() === 'true';

const lastRunFor = async (job) => {
  const record = await AutomationRun.findOne({ job }).lean();
  return record?.lastRunAt || null;
};

const due = (lastRunAt, intervalMs) =>
  !lastRunAt || Date.now() - new Date(lastRunAt).getTime() >= intervalMs;

const runJob = async (job, handler) => {
  try {
    const summary = await handler();
    logger.info(`[automation] ${job} completed ${JSON.stringify(summary).slice(0, 300)}`);
  } catch (error) {
    logger.error(`[automation] ${job} failed: ${error.message}`);
    await AutomationRun.findOneAndUpdate(
      { job },
      { job, lastRunAt: new Date(), lastStatus: 'FAILED', lastError: error.message.slice(0, 500) },
      { upsert: true },
    );
  }
};

const tick = async () => {
  if (running || isDisabled()) return;
  running = true;
  try {
    if (due(await lastRunFor(JOBS.REMINDERS), DAY_MS - 60 * 1000)) {
      await runJob(JOBS.REMINDERS, () => runReminders());
    }
    // Absent marking changes payroll inputs, so it stays manual unless the
    // deployment opts in with ENABLE_AUTO_ABSENT=true.
    const autoAbsentEnabled = String(process.env.ENABLE_AUTO_ABSENT || '').toLowerCase() === 'true';
    if (autoAbsentEnabled && due(await lastRunFor(JOBS.AUTO_ABSENT), DAY_MS - 60 * 1000)) {
      await runJob(JOBS.AUTO_ABSENT, () => markAutoAbsent());
    }
    // Balances are yearly, so the job runs once per calendar year and is
    // idempotent even if it is triggered again from the admin page.
    const year = time.yearOf();
    const accrualRun = await AutomationRun.findOne({ job: JOBS.LEAVE_ACCRUAL }).lean();
    const accrualYear = accrualRun?.lastSummary?.year;
    if (!accrualRun || accrualYear !== year) {
      await runJob(JOBS.LEAVE_ACCRUAL, () => initializeLeaveBalances({ year }));
    }
  } finally {
    running = false;
  }
};

const startScheduler = () => {
  if (isDisabled()) {
    logger.warn('[automation] scheduler disabled (DISABLE_AUTOMATION=true)');
    return null;
  }
  if (timer) return timer;
  // Give the API a moment to settle before the first background pass.
  setTimeout(() => tick().catch((error) => logger.error(`[automation] tick failed: ${error.message}`)), 20 * 1000);
  timer = setInterval(() => tick().catch((error) => logger.error(`[automation] tick failed: ${error.message}`)), TICK_MS);
  if (timer.unref) timer.unref();
  logger.info(`[automation] scheduler started (tick every ${TICK_MS / 60000} minutes)`);
  return timer;
};

const stopScheduler = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

module.exports = { startScheduler, stopScheduler, tick };
