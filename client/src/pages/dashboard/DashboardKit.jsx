import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CakeSlice,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coffee,
  Home,
  LifeBuoy,
  LogOut,
  PartyPopper,
  Sparkles,
  Sun,
  Ticket,
  Users,
  Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';
import StatCard from '../../components/ui/StatCard';
import { Card, CardHeader } from '../../components/ui/Card';
import { ProgressRing, ProgressBar } from '../../components/ui/Progress';
import { AnimatedNumber, easeLiquid } from '../../components/ui/motion';
import { formatDate } from '../../utils/format';
import cn from '../../utils/cn';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export const DashboardHero = ({ eyebrow, name, title, description, actions, pulse }) => {
  const attendance = pulse?.attendance;
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-white/85 bg-white/60 p-5 shadow-glass backdrop-blur-2xl sm:p-7">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <span className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-lavender-200/60 blur-3xl" />
        <span className="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-aqua-200/55 blur-3xl" />
        <span className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-peach-200/50 blur-3xl" />
        <span className="absolute inset-x-0 top-0 h-24 bg-sheen opacity-60" />
      </div>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="eyebrow text-navy-500">{eyebrow}</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[32px]">
            {name ? `${greeting()}, ${name}.` : title}
          </h1>
          {name ? <p className="mt-1 font-display text-sm font-medium text-slate-600">{title}</p> : null}
          {description ? <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">{description}</p> : null}
          {actions?.length ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        {attendance ? (
          <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-white/90 bg-white/70 p-4 shadow-inset backdrop-blur">
            <ProgressRing value={attendance.rate} size={92} stroke={9} tone="aqua">
              <span className="font-display text-lg font-semibold text-slate-900">
                <AnimatedNumber value={attendance.rate} format={(number) => `${Math.round(number)}%`} />
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Present</span>
            </ProgressRing>
            <div className="space-y-1.5 text-xs">
              <p className="flex items-center gap-2 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-gradient-to-br from-mint-400 to-emerald-500" />
                On desk <span className="font-semibold text-slate-900">{attendance.present}</span>
              </p>
              <p className="flex items-center gap-2 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-gradient-to-br from-aqua-300 to-sky-400" />
                Remote <span className="font-semibold text-slate-900">{attendance.wfh}</span>
              </p>
              <p className="flex items-center gap-2 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-gradient-to-br from-lavender-300 to-violet-400" />
                On leave <span className="font-semibold text-slate-900">{attendance.onLeave}</span>
              </p>
              <p className="flex items-center gap-2 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-gradient-to-br from-coral-300 to-rose-400" />
                Not in <span className="font-semibold text-slate-900">{attendance.notMarked + attendance.absent}</span>
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export const PulseTiles = ({ pulse }) => {
  const attendance = pulse?.attendance;
  if (!attendance) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Present today" value={attendance.present} hint={`of ${attendance.total} active employees`} icon={Clock} tone="mint" to="/attendance/records" />
      <StatCard label="Working remotely" value={attendance.wfh} hint="Approved work from home" icon={Home} tone="aqua" to="/wfh" />
      <StatCard label="On leave" value={attendance.onLeave} hint="Approved leave today" icon={CalendarDays} tone="lavender" to="/leave/calendar" />
      <StatCard label="Not marked" value={attendance.absent + attendance.notMarked} hint="Absent or pending check-in" icon={Users} tone="peach" to="/attendance/records" />
    </div>
  );
};

const approvalRows = [
  { key: 'leaves', label: 'Leave requests', icon: CalendarDays, to: '/leave/approvals', tint: 'bg-lavender-100 text-lavender-600' },
  { key: 'wfh', label: 'Work-from-home requests', icon: Home, to: '/wfh', tint: 'bg-aqua-100 text-aqua-600' },
  { key: 'reports', label: 'Performance reports', icon: Ticket, to: '/hr/reviews', tint: 'bg-peach-100 text-peach-600' },
  { key: 'tickets', label: 'Open helpdesk tickets', icon: LifeBuoy, to: '/helpdesk', tint: 'bg-mint-100 text-mint-600' },
  { key: 'exits', label: 'Exit and offboarding', icon: LogOut, to: '/exit', tint: 'bg-blush-100 text-blush-600' },
];

export const PendingApprovalsCard = ({ pulse, reportLink }) => {
  const pending = pulse?.pending;
  if (!pending) return null;
  const rows = approvalRows.map((row) => (row.key === 'reports' && reportLink ? { ...row, to: reportLink } : row));
  return (
    <Card className="h-full">
      <CardHeader
        title="Pending approvals"
        description={pending.total ? `${pending.total} item(s) need a decision` : 'Everything is up to date'}
        icon={CheckCircle2}
        actions={
          <span
            className={cn(
              'chip',
              pending.total ? 'bg-sun-100/80 text-amber-700' : 'bg-mint-100/80 text-emerald-700',
            )}
          >
            {pending.total ? `${pending.total} open` : 'All clear'}
          </span>
        }
      />
      <div className="divide-y divide-white/70">
        {rows.map((row) => {
          const Icon = row.icon;
          const value = pending[row.key] || 0;
          return (
            <Link key={row.key} to={row.to} className="group flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-white/70">
              <span className="flex min-w-0 items-center gap-3">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', row.tint)}>
                  <Icon size={15} />
                </span>
                <span className="truncate text-sm text-slate-700">{row.label}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={cn('font-display text-sm font-semibold', value ? 'text-slate-900' : 'text-slate-400')}>{value}</span>
                <ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
};

export const PeopleMomentsCard = ({ pulse }) => {
  const birthdays = pulse?.birthdays || [];
  const anniversaries = pulse?.anniversaries || [];
  const holidays = pulse?.holidays || [];

  return (
    <Card className="h-full">
      <CardHeader title="People moments" description="Celebrations and upcoming time off" icon={PartyPopper} />
      <div className="space-y-4 p-5">
        <div>
          <p className="eyebrow mb-2 flex items-center gap-1.5 text-blush-500">
            <CakeSlice size={13} /> Birthdays this month
          </p>
          {birthdays.length ? (
            <ul className="space-y-1.5">
              {birthdays.map((person) => (
                <li key={person._id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-700">{person.name}</span>
                  <span
                    className={cn(
                      'chip shrink-0',
                      person.isToday ? 'bg-grad-blush text-pink-900' : 'bg-white/80 text-slate-600',
                    )}
                  >
                    {person.isToday ? 'Today' : `${person.day} ${new Date(person.date).toLocaleDateString('en-IN', { month: 'short' })}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No birthdays recorded for this month.</p>
          )}
        </div>

        <div className="border-t border-white/70 pt-3">
          <p className="eyebrow mb-2 flex items-center gap-1.5 text-lavender-500">
            <Sparkles size={13} /> Work anniversaries
          </p>
          {anniversaries.length ? (
            <ul className="space-y-1.5">
              {anniversaries.map((person) => (
                <li key={person._id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-700">{person.name}</span>
                  <span className="chip shrink-0 bg-lavender-100/80 text-lavender-600">{person.years} yr</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No anniversaries this month.</p>
          )}
        </div>

        <div className="border-t border-white/70 pt-3">
          <p className="eyebrow mb-2 flex items-center gap-1.5 text-peach-500">
            <Sun size={13} /> Upcoming holidays
          </p>
          {holidays.length ? (
            <ul className="space-y-1.5">
              {holidays.map((holiday) => (
                <li key={holiday._id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-slate-700">{holiday.name}</span>
                    <span className="block text-[11px] text-slate-400">{formatDate(holiday.date)}</span>
                  </span>
                  <span className="chip shrink-0 bg-peach-100/80 text-peach-600">
                    {holiday.daysAway === 0 ? 'Today' : `${holiday.daysAway}d`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No upcoming holidays configured.</p>
          )}
        </div>
      </div>
    </Card>
  );
};

const quickActionTones = {
  aqua: 'tile-aqua',
  lavender: 'tile-lavender',
  mint: 'tile-mint',
  peach: 'tile-peach',
  blush: 'tile-blush',
  sun: 'tile-sun',
  sky: 'tile-sky',
  pista: 'tile-pista',
};

export const QuickActions = ({ actions = [] }) => (
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {actions.map((action, index) => {
      const Icon = action.icon || ArrowRight;
      return (
        <motion.div
          key={action.to + action.label}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: index * 0.05, ease: easeLiquid }}
        >
          <Link
            to={action.to}
            className={cn(
              'group flex h-full items-start gap-3 rounded-2xl border border-white/85 p-3.5 shadow-inset transition duration-300 ease-liquid hover:-translate-y-0.5 hover:shadow-glass',
              quickActionTones[action.tone] || quickActionTones.lavender,
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/85 text-navy-600 shadow-inset ring-1 ring-white transition group-hover:rotate-3 group-hover:scale-105">
              <Icon size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">{action.label}</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-600/80">{action.description}</span>
            </span>
          </Link>
        </motion.div>
      );
    })}
  </div>
);

export const DepartmentCard = ({ departments = [], title = 'Headcount by department', description }) => {
  const max = Math.max(...departments.map((item) => item.count), 1);
  return (
    <Card className="h-full">
      <CardHeader title={title} description={description} icon={Users} />
      <div className="space-y-3 p-5">
        {departments.length ? (
          departments.map((dept) => (
            <div key={dept._id || dept.name}>
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-medium text-slate-700">{dept.name || 'Unassigned'}</span>
                <span className="text-slate-500">{dept.count}</span>
              </div>
              <div className="mt-1.5">
                <ProgressBar value={(dept.count / max) * 100} tone={['aqua', 'indigo', 'mint', 'peach'][dept.count % 4]} size="sm" />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No department data available.</p>
        )}
      </div>
    </Card>
  );
};

export const ActivityCard = ({ activities = [], title = 'Recent activity', description, action, icon = Clock }) => (
  <Card className="h-full">
    <CardHeader title={title} description={description} icon={icon} actions={action} />
    <div className="divide-y divide-white/70">
      {activities.length ? (
        activities.map((item, index) => (
          <motion.div
            key={item._id || index}
            className="flex flex-wrap items-start justify-between gap-2 px-5 py-3"
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: index * 0.03 }}
          >
            <div className="min-w-0">
              <p className="text-sm text-slate-800">{item.description || item.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {item.actorName || 'System'}
                {item.module ? ` · ${item.module}` : ''}
                {item.createdAt ? ` · ${formatDate(item.createdAt)}` : ''}
              </p>
            </div>
            {item.amount ? <span className="text-xs font-semibold text-slate-700">{item.amount}</span> : null}
          </motion.div>
        ))
      ) : (
        <p className="px-5 py-8 text-center text-sm text-slate-500">No activity recorded yet.</p>
      )}
    </div>
  </Card>
);

export const StatStrip = ({ items = [] }) => (
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {items.map((item) => (
      <StatCard key={item.label} {...item} />
    ))}
  </div>
);

export const PayrollMiniCard = ({ data }) => (
  <Card className="h-full">
    <CardHeader title="Payroll snapshot" description={data?.monthLabel} icon={Wallet} />
    <div className="space-y-3 p-5 text-sm">
      {data?.rows?.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-2">
          <span className="text-slate-600">{row.label}</span>
          <span className="font-semibold text-slate-900">{row.value}</span>
        </div>
      ))}
      {data?.action ? (
        <Link to={data.action.to} className="btn btn-secondary btn-sm w-full">
          {data.action.label}
        </Link>
      ) : null}
    </div>
  </Card>
);

export const AttendanceLegend = () => (
  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
    <span className="flex items-center gap-1.5">
      <Coffee size={12} /> Breaks are excluded from effective hours
    </span>
  </div>
);

export default DashboardHero;
