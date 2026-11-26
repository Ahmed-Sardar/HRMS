import { statusColor, statusLabel } from '../../utils/format';
import { ROLE_LABELS } from '../../utils/constants';
import cn from '../../utils/cn';

export const Badge = ({ children, className, tone }) => (
  <span className={cn('chip', tone || 'bg-slate-100 text-slate-600', className)}>{children}</span>
);

export const StatusBadge = ({ status, labels }) => (
  <span className={cn('chip', statusColor(status))}>{statusLabel(status, labels)}</span>
);

export const RoleBadge = ({ role }) => (
  <span
    className={cn(
      'chip',
      role === 'SUPER_ADMIN' && 'bg-navy-800 text-white',
      role === 'ADMIN' && 'bg-indigo-50 text-indigo-700',
      role === 'HR' && 'bg-emerald-50 text-emerald-700',
      role === 'FINANCE' && 'bg-amber-50 text-amber-700',
      role === 'EMPLOYEE' && 'bg-slate-100 text-slate-600',
    )}
  >
    {ROLE_LABELS[role] || role}
  </span>
);

export default Badge;
