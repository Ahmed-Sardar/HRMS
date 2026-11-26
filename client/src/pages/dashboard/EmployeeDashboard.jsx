import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  AlarmClock,
  CalendarDays,
  Home,
  Coffee,
  Download,
  FileText,
  LogIn,
  LogOut,
  Megaphone,
  Timer,
  TrendingUp,
  Wallet,
  Bell,
} from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { attendanceService } from '../../services/attendance.service';
import { payrollService } from '../../services/payroll.service';
import { getErrorMessage } from '../../services/api';
import {
  formatDate,
  formatTime,
  minutesToDuration,
  relativeTime,
  monthLabel,
  statusColor,
  formatCurrency,
} from '../../utils/format';
import { ATTENDANCE_STATUS_LABELS, REPORT_STATUS_LABELS } from '../../utils/constants';
import { DashboardHero, PeopleMomentsCard } from './DashboardKit';
import cn from '../../utils/cn';

const EmployeeDashboard = ({ data, user, onRefresh }) => {
  const dispatch = useDispatch();
  const [today, setToday] = useState(data.today);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setToday(data.today);
  }, [data.today]);

  useEffect(() => {
    if (!today?.attendance?.checkIn || today?.attendance?.checkOut) return undefined;
    const compute = () => {
      const start = new Date(today.attendance.checkIn).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 60000)));
    };
    compute();
    const timer = setInterval(compute, 30000);
    return () => clearInterval(timer);
  }, [today]);

  const run = async (action, successMessage) => {
    setBusy(true);
    try {
      const result = await action();
      if (result?.today) setToday(result.today);
      else if (result?.attendance !== undefined) setToday(result);
      dispatch(toast(successMessage));
      onRefresh?.();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const attendance = today?.attendance;
  const isCheckedIn = Boolean(attendance?.checkIn);
  const isCheckedOut = Boolean(attendance?.checkOut);
  const onBreak = Boolean(today?.activeBreak);
  const monthSummary = data.monthSummary || {};
  const breakMinutes = today?.liveBreakMinutes || 0;
  const workedMinutes = elapsed ? Math.max(0, elapsed - breakMinutes) : attendance?.effectiveMinutes || 0;

  return (
    <div className="space-y-5">
      <DashboardHero
        eyebrow={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        name={user?.name}
        title={`Your snapshot for ${monthLabel(data.month)}`}
        description="Here is your attendance, leave, remote work and performance overview for the month."
        actions={[
          <Link key="leave" to="/leave/my" className="btn btn-secondary">
            <CalendarDays size={16} /> Apply for leave
          </Link>,
          <Link key="wfh" to="/wfh" className="btn btn-secondary">
            <Home size={16} /> Request WFH
          </Link>,
          <Link key="report" to="/performance/reports/new" className="btn btn-primary">
            <FileText size={16} /> New report
          </Link>,
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Today's attendance"
            description={today?.shift?.name ? `${today.shift.name} · ${today.shift.startTime} - ${today.shift.endTime}` : 'Shift not configured'}
            actions={<StatusBadge status={attendance?.status || (isCheckedOut ? 'PRESENT' : 'ABSENT')} labels={ATTENDANCE_STATUS_LABELS} />}
          />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="tile tile-sky p-3">
              <p className="stat-label">Check in</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatTime(attendance?.checkIn)}</p>
              {attendance?.isLate ? <p className="mt-0.5 text-xs font-medium text-amber-600">Late by {attendance.lateMinutes} min</p> : null}
            </div>
            <div className="tile tile-lavender p-3">
              <p className="stat-label">Check out</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatTime(attendance?.checkOut)}</p>
              {attendance?.earlyDepartureMinutes > 0 ? (
                <p className="mt-0.5 text-xs font-medium text-amber-600">Early by {attendance.earlyDepartureMinutes} min</p>
              ) : null}
            </div>
            <div className="tile tile-mint p-3">
              <p className="stat-label">Effective hours</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {minutesToDuration(isCheckedIn && !isCheckedOut ? workedMinutes : attendance?.effectiveMinutes || 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {attendance?.breaks?.length || 0} break(s) · {minutesToDuration(isCheckedIn && !isCheckedOut ? breakMinutes : attendance?.breakMinutes || 0)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-4">
            {!isCheckedIn ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => run(() => attendanceService.checkIn(), 'Checked in successfully')}
              >
                <LogIn size={16} /> Check in
              </button>
            ) : null}
            {isCheckedIn && !isCheckedOut ? (
              onBreak ? (
                <button
                  type="button"
                  className="btn bg-amber-500 text-white hover:bg-amber-600"
                  disabled={busy}
                  onClick={() => run(() => attendanceService.endBreak(), 'Break ended')}
                >
                  <Coffee size={16} /> End break
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => run(() => attendanceService.startBreak('LUNCH'), 'Break started')}
                >
                  <Coffee size={16} /> Start break
                </button>
              )
            ) : null}
            {isCheckedIn && !isCheckedOut ? (
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => run(() => attendanceService.checkOut(), 'Checked out successfully')}
              >
                <LogOut size={16} /> Check out
              </button>
            ) : null}
            {isCheckedOut ? (
              <p className="text-sm text-slate-500">
                Your attendance for today is closed. Need a fix? <Link to="/attendance/corrections" className="font-semibold text-navy-800 hover:underline">Request a correction</Link>.
              </p>
            ) : null}
            {onBreak ? (
              <span className="chip bg-amber-50 text-amber-700">
                <Timer size={12} /> On break since {formatTime(today.activeBreak?.start)}
              </span>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Leave balance" description={`Allocated for ${new Date().getFullYear()}`} />
          <div className="space-y-3 p-5">
            {data.leaveBalance?.length ? (
              data.leaveBalance.map((item) => (
                <div key={item.type}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{item.name}</span>
                    <span className="text-slate-500">
                      {item.available} / {item.allocated} days
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-navy-700"
                      style={{ width: `${Math.min(100, item.allocated ? (item.available / item.allocated) * 100 : 0)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No leave balance configured yet.</p>
            )}
            <Link to="/leave/my" className="btn btn-secondary btn-sm w-full">
              View leave history
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Days present" value={monthSummary.present ?? 0} hint={`${monthLabel(data.month)}`} icon={CalendarDays} tone="emerald" />
        <StatCard label="Late marks" value={monthSummary.late ?? 0} hint="Late arrivals this month" icon={AlarmClock} tone="amber" />
        <StatCard label="Effective hours" value={minutesToDuration(monthSummary.effectiveMinutes || 0)} hint="This month" icon={Timer} tone="blue" />
        <StatCard label="Overtime" value={minutesToDuration(monthSummary.overtimeMinutes || 0)} hint="This month" icon={TrendingUp} tone="indigo" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="My performance reports"
            description="Draft, submit and track finance/HR approvals"
            actions={
              <Link to="/performance/reports" className="btn btn-secondary btn-sm">
                View all
              </Link>
            }
          />
          {data.reports?.length ? (
            <div className="divide-y divide-slate-100">
              {data.reports.map((report) => (
                <Link
                  key={report._id}
                  to={`/performance/reports/${report._id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{report.title}</p>
                    <p className="text-xs text-slate-500">
                      {report.periodType} · {formatDate(report.periodStart)} - {formatDate(report.periodEnd)}
                    </p>
                  </div>
                  <StatusBadge status={report.status} labels={REPORT_STATUS_LABELS} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-slate-500">You have not created any performance reports yet.</p>
              <Link to="/performance/reports/new" className="btn btn-primary btn-sm mt-3">
                Create your first report
              </Link>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Payslips" description="Latest approved payroll" />
          <div className="divide-y divide-slate-100">
            {data.payslips?.length ? (
              data.payslips.map((payslip) => (
                <div key={payslip._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{monthLabel(payslip.month)}</p>
                    <p className="text-xs text-slate-500">
                      Net {formatCurrency(payslip.netPay)} · {payslip.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      try {
                        await payrollService.payslip(payslip._id);
                      } catch (error) {
                        dispatch(toast(getErrorMessage(error), 'error'));
                      }
                    }}
                  >
                    <Download size={13} /> PDF
                  </button>
                </div>
              ))
            ) : (
              <p className="px-5 py-6 text-sm text-slate-500">No payslips published yet.</p>
            )}
          </div>
          <div className="border-t border-slate-100 px-5 py-3">
            <Link to="/payroll/my" className="text-sm font-semibold text-navy-800 hover:underline">
              View all payslips
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Recent activity" description="Your latest notifications" />
          <div className="divide-y divide-slate-100">
            {data.notifications?.length ? (
              data.notifications.map((item) => (
                <div key={item._id} className="flex gap-3 px-5 py-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-800">
                    <Bell size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
                    <p className="line-clamp-2 text-xs text-slate-500">{item.message}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{relativeTime(item.createdAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-5 py-6 text-sm text-slate-500">No notifications yet.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Announcements" description="Company updates for everyone" />
          <div className="divide-y divide-slate-100">
            {data.announcements?.length ? (
              data.announcements.map((item) => (
                <div key={item._id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                      <Megaphone size={15} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.content}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{formatDate(item.publishedAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-5 py-6 text-sm text-slate-500">No announcements published.</p>
            )}
          </div>
          <div className="border-t border-slate-100 px-5 py-3">
            <Link to="/announcements" className="text-sm font-semibold text-navy-800 hover:underline">
              All announcements
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending leave" value={data.cards?.pendingLeaves ?? 0} hint="Awaiting approval" icon={CalendarDays} tone="amber" to="/leave/my" />
        <StatCard label="Open reports" value={data.cards?.pendingReports ?? 0} hint="In approval workflow" icon={FileText} tone="blue" to="/performance/reports" />
        <StatCard label="Assigned assets" value={data.cards?.assets ?? 0} hint="Company equipment" icon={Wallet} tone="slate" to="/assets" />
        <StatCard label="Unread alerts" value={data.cards?.unreadNotifications ?? 0} hint="Notifications" icon={Bell} tone="indigo" to="/notifications" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {data.calendar?.length ? (
          <Card className="xl:col-span-2">
            <CardHeader
              title="Recent attendance"
              description="Last two weeks of recorded days"
              actions={
                <Link to="/attendance/my" className="btn btn-secondary btn-sm">
                  Full calendar
                </Link>
              }
            />
            <div className="flex flex-wrap gap-2 p-5">
              {data.calendar.map((day) => (
                <div
                  key={day.date}
                  className={cn('rounded-xl border border-white/80 px-2.5 py-1.5 text-center shadow-inset', statusColor(day.status))}
                  title={`${day.date} · ${day.status || 'No record'}`}
                >
                  <p className="text-[11px] font-semibold">{new Date(day.date).getDate()}</p>
                  <p className="text-[10px]">{ATTENDANCE_STATUS_LABELS[day.status] || '—'}</p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
        <PeopleMomentsCard pulse={data.pulse} />
      </div>
    </div>
  );
};

export default EmployeeDashboard;
