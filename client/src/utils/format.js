import { formatEnum } from './constants';

export { formatEnum };

export const formatDate = (value, options) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', options || { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (value) => {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export const minutesToDuration = (minutes = 0) => {
  const safe = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
};

export const minutesToHours = (minutes = 0) => (Math.max(0, Number(minutes) || 0) / 60).toFixed(1);

export const formatCurrency = (amount, currency = 'INR') => {
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
};

export const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(Number(value) || 0);

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'HR';

export const relativeTime = (value) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
};

export const monthLabel = (month) => {
  if (!month) return '-';
  const date = new Date(`${month}-01`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

export const currentMonth = () => new Date().toISOString().slice(0, 7);

/** Tailwind classes per semantic status colour. */
export const statusColor = (status) => {
  const key = String(status || '').toUpperCase();
  const map = {
    PRESENT: 'bg-emerald-50 text-emerald-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    ACTIVE: 'bg-emerald-50 text-emerald-700',
    PAID: 'bg-emerald-50 text-emerald-700',
    COMPLETED: 'bg-emerald-50 text-emerald-700',
    HR_APPROVED: 'bg-emerald-50 text-emerald-700',
    FINANCE_APPROVED: 'bg-emerald-50 text-emerald-700',
    VERIFIED: 'bg-emerald-50 text-emerald-700',
    HIRED: 'bg-emerald-50 text-emerald-700',
    AVAILABLE: 'bg-emerald-50 text-emerald-700',
    LATE: 'bg-amber-50 text-amber-700',
    HALF_DAY: 'bg-amber-50 text-amber-700',
    PENDING: 'bg-amber-50 text-amber-700',
    SUBMITTED: 'bg-blue-50 text-blue-700',
    UNDER_FINANCE_REVIEW: 'bg-blue-50 text-blue-700',
    UNDER_HR_REVIEW: 'bg-blue-50 text-blue-700',
    FORWARDED_TO_HR: 'bg-indigo-50 text-indigo-700',
    CORRECTION_REQUESTED: 'bg-orange-50 text-orange-700',
    PROBATION: 'bg-sky-50 text-sky-700',
    NOTICE_PERIOD: 'bg-orange-50 text-orange-700',
    DRAFT: 'bg-slate-100 text-slate-600',
    ON_LEAVE: 'bg-indigo-50 text-indigo-700',
    HOLIDAY: 'bg-violet-50 text-violet-700',
    WEEKLY_OFF: 'bg-slate-100 text-slate-600',
    ABSENT: 'bg-red-50 text-red-700',
    REJECTED: 'bg-red-50 text-red-700',
    FINANCE_REJECTED: 'bg-red-50 text-red-700',
    HR_REJECTED: 'bg-red-50 text-red-700',
    TERMINATED: 'bg-red-50 text-red-700',
    CANCELLED: 'bg-slate-100 text-slate-600',
    ASSIGNED: 'bg-blue-50 text-blue-700',
    WFH: 'bg-teal-50 text-teal-700',
    MANAGER_APPROVED: 'bg-blue-50 text-blue-700',
    OPEN: 'bg-amber-50 text-amber-700',
    IN_PROGRESS: 'bg-blue-50 text-blue-700',
    WAITING_ON_EMPLOYEE: 'bg-orange-50 text-orange-700',
    RESOLVED: 'bg-emerald-50 text-emerald-700',
    CLOSED: 'bg-slate-100 text-slate-600',
    PENDING_MANAGER: 'bg-amber-50 text-amber-700',
    PENDING_HR: 'bg-blue-50 text-blue-700',
    CLEARED: 'bg-emerald-50 text-emerald-700',
    NOT_REQUIRED: 'bg-slate-100 text-slate-600',
    SETTLED: 'bg-emerald-50 text-emerald-700',
    WITHDRAWN: 'bg-slate-100 text-slate-600',
    REMOTE: 'bg-sky-50 text-sky-700',
    HYBRID: 'bg-violet-50 text-violet-700',
  };
  return map[key] || 'bg-slate-100 text-slate-600';
};

export const statusLabel = (status, labels = {}) => labels[status] || formatEnum(status);

export const fileSize = (bytes = 0) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};
