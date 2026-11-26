const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const DEFAULT_TZ = 'Asia/Kolkata';

const now = () => new Date();

const tzNow = (timezoneName = DEFAULT_TZ) => dayjs().tz(timezoneName || DEFAULT_TZ);

const dateKey = (date = new Date(), timezoneName = DEFAULT_TZ) =>
  dayjs(date).tz(timezoneName || DEFAULT_TZ).format('YYYY-MM-DD');

const monthKey = (date = new Date(), timezoneName = DEFAULT_TZ) =>
  dayjs(date).tz(timezoneName || DEFAULT_TZ).format('YYYY-MM');

const startOfDay = (date) => dayjs(date).startOf('day').toDate();
const endOfDay = (date) => dayjs(date).endOf('day').toDate();

const timeToMinutes = (value = '00:00') => {
  const [hours, minutes] = String(value).split(':').map((part) => Number.parseInt(part, 10) || 0);
  return hours * 60 + minutes;
};

const minutesToDuration = (totalMinutes = 0) => {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
};

/** Builds a Date for a date key + HH:mm in the given timezone. */
const combineDateAndTime = (dateStr, timeStr, timezoneName = DEFAULT_TZ) => {
  const [hours, minutes] = String(timeStr || '00:00').split(':').map((part) => Number.parseInt(part, 10) || 0);
  return dayjs
    .tz(`${dateStr} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, timezoneName || DEFAULT_TZ)
    .toDate();
};

const monthRange = (month, timezoneName = DEFAULT_TZ) => {
  const base = dayjs(`${month}-01`).isValid() ? dayjs(`${month}-01`) : dayjs();
  const start = base.startOf('month');
  const end = base.endOf('month');
  return {
    start: start.toDate(),
    end: end.toDate(),
    startKey: start.format('YYYY-MM-DD'),
    endKey: end.format('YYYY-MM-DD'),
    month: start.format('YYYY-MM'),
    year: start.year(),
  };
};

const listDateKeys = (startDate, endDate) => {
  const keys = [];
  let cursor = dayjs(startDate).startOf('day');
  const last = dayjs(endDate).startOf('day');
  while (cursor.isSameOrBefore(last, 'day')) {
    keys.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(1, 'day');
  }
  return keys;
};

/** Counts payable working days between two dates, excluding weekly offs and holidays. */
const countWorkingDays = ({ startDate, endDate, workingDays = [1, 2, 3, 4, 5], holidayKeys = [] }) => {
  const holidaySet = new Set(holidayKeys);
  let total = 0;
  listDateKeys(startDate, endDate).forEach((key) => {
    const dow = dayjs(key).day();
    if (workingDays.includes(dow) && !holidaySet.has(key)) total += 1;
  });
  return total;
};

const isWeeklyOff = (date, workingDays = [1, 2, 3, 4, 5]) =>
  !workingDays.includes(dayjs(date).day());

const formatDate = (date) => (date ? dayjs(date).format('DD MMM YYYY') : '-');
const formatDateTime = (date) => (date ? dayjs(date).format('DD MMM YYYY, HH:mm') : '-');
const formatTime = (date) => (date ? dayjs(date).format('HH:mm') : '-');

const diffMinutes = (from, to) => {
  if (!from || !to) return 0;
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
};

const startOfMonth = (date = new Date()) => dayjs(date).startOf('month').toDate();
const endOfMonth = (date = new Date()) => dayjs(date).endOf('month').toDate();
const addDays = (date, days) => dayjs(date).add(days, 'day').toDate();
const yearOf = (date = new Date()) => dayjs(date).year();
const monthName = (date) => (date ? dayjs(date).format('MMMM YYYY') : '-');

module.exports = {
  dayjs,
  DEFAULT_TZ,
  now,
  tzNow,
  dateKey,
  monthKey,
  startOfDay,
  endOfDay,
  timeToMinutes,
  minutesToDuration,
  combineDateAndTime,
  monthRange,
  listDateKeys,
  countWorkingDays,
  isWeeklyOff,
  formatDate,
  formatDateTime,
  formatTime,
  diffMinutes,
  startOfMonth,
  endOfMonth,
  addDays,
  yearOf,
  monthName,
};
