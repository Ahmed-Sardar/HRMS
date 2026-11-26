import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  CalendarDays,
  Coffee,
  LogIn,
  LogOut,
  Timer,
  TrendingUp,
  Clock,
  ClipboardCheck,
  AlarmClock,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Input, Textarea } from '../../components/ui/Field';
import { PageLoader } from '../../components/ui/Loader';
import { toast } from '../../store/uiSlice';
import { attendanceService } from '../../services/attendance.service';
import { getErrorMessage } from '../../services/api';
import {
  currentMonth,
  monthLabel,
  formatDate,
  formatTime,
  statusColor,
  minutesToDuration,
} from '../../utils/format';
import { ATTENDANCE_STATUS_LABELS } from '../../utils/constants';
import cn from '../../utils/cn';

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const buildDateTime = (date, time) => {
  if (!date || !time) return undefined;
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
};

const MyAttendancePage = () => {
  const dispatch = useDispatch();
  const [month, setMonth] = useState(currentMonth());
  const [today, setToday] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [history, setHistory] = useState({ items: [], summary: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [correctionModal, setCorrectionModal] = useState(false);
  const [correction, setCorrection] = useState({ date: '', checkIn: '', checkOut: '', reason: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [todayData, calendarData, historyData] = await Promise.all([
        attendanceService.today(),
        attendanceService.calendar({ month }),
        attendanceService.my({ month, limit: 31 }),
      ]);
      setToday(todayData);
      setCalendar(calendarData);
      setHistory(historyData);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, month]);

  useEffect(() => {
    load();
  }, [load]);

  const action = async (fn, message) => {
    setBusy(true);
    try {
      const result = await fn();
      if (result?.today) setToday(result.today);
      else if (result?.attendance !== undefined) setToday(result);
      dispatch(toast(message));
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const submitCorrection = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await attendanceService.requestCorrection({
        date: correction.date,
        requestedCheckIn: buildDateTime(correction.date, correction.checkIn),
        requestedCheckOut: buildDateTime(correction.date, correction.checkOut),
        reason: correction.reason,
      });
      dispatch(toast('Correction request submitted for HR review'));
      setCorrectionModal(false);
      setCorrection({ date: '', checkIn: '', checkOut: '', reason: '' });
      load();
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

  const calendarCells = useMemo(() => {
    if (!calendar?.days?.length) return [];
    const firstDay = new Date(calendar.days[0].date).getDay();
    const padded = Array.from({ length: firstDay }).map(() => null);
    return [...padded, ...calendar.days];
  }, [calendar]);

  if (loading && !calendar) return <PageLoader label="Loading attendance..." />;

  return (
    <div>
      <PageHeader
        title="My attendance"
        description="Check in, manage breaks and review your monthly attendance calendar."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'My attendance' }]}
        actions={
          <>
            <input type="month" className="field w-auto" value={month} onChange={(event) => setMonth(event.target.value)} />
            <button type="button" className="btn btn-secondary" onClick={() => setCorrectionModal(true)}>
              <ClipboardCheck size={15} /> Request correction
            </button>
          </>
        }
      />

      <Card className="mb-4">
        <CardHeader
          title="Today"
          description={today?.shift ? `${today.shift.name} · ${today.shift.startTime} - ${today.shift.endTime}` : 'Shift not configured'}
          actions={<StatusBadge status={attendance?.status || 'ABSENT'} labels={ATTENDANCE_STATUS_LABELS} />}
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="stat-label">Check in</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatTime(attendance?.checkIn)}</p>
            {attendance?.isLate ? <p className="text-xs font-medium text-amber-600">Late {attendance.lateMinutes}m</p> : null}
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="stat-label">Check out</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatTime(attendance?.checkOut)}</p>
            {attendance?.earlyDepartureMinutes ? (
              <p className="text-xs font-medium text-amber-600">Early {attendance.earlyDepartureMinutes}m</p>
            ) : null}
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="stat-label">Break time</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {minutesToDuration(attendance?.breakMinutes || 0)}
            </p>
            <p className="text-xs text-slate-500">{attendance?.breaks?.length || 0} break(s)</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="stat-label">Effective hours</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {minutesToDuration(attendance?.effectiveMinutes || 0)}
            </p>
            <p className="text-xs text-slate-500">Overtime {minutesToDuration(attendance?.overtimeMinutes || 0)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-4">
          {!isCheckedIn ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => action(() => attendanceService.checkIn(), 'Checked in')}>
              <LogIn size={16} /> Check in
            </button>
          ) : null}
          {isCheckedIn && !isCheckedOut ? (
            <>
              {onBreak ? (
                <button type="button" className="btn bg-amber-500 text-white hover:bg-amber-600" disabled={busy} onClick={() => action(() => attendanceService.endBreak(), 'Break ended')}>
                  <Coffee size={16} /> End break
                </button>
              ) : (
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => action(() => attendanceService.startBreak('LUNCH'), 'Break started')}>
                  <Coffee size={16} /> Start break
                </button>
              )}
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => action(() => attendanceService.checkOut(), 'Checked out')}>
                <LogOut size={16} /> Check out
              </button>
            </>
          ) : null}
          {isCheckedOut ? <span className="text-sm text-slate-500">Attendance closed for today. Corrections require HR approval.</span> : null}
          {onBreak ? (
            <span className="chip bg-amber-50 text-amber-700">
              <Timer size={12} /> Break started {formatTime(today.activeBreak?.start)}
            </span>
          ) : null}
        </div>
        {attendance?.breaks?.length ? (
          <div className="border-t border-slate-100 px-5 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Breaks today</p>
            <div className="flex flex-wrap gap-2">
              {attendance.breaks.map((item) => (
                <span key={item._id} className="chip bg-slate-100 text-slate-600">
                  {formatTime(item.start)} - {item.end ? formatTime(item.end) : 'Active'} · {minutesToDuration(item.durationMinutes || 0)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Present days" value={calendar?.summary?.present ?? 0} hint={monthLabel(month)} icon={CalendarDays} tone="emerald" />
        <StatCard label="Late marks" value={calendar?.summary?.late ?? 0} hint="This month" icon={AlarmClock} tone="amber" />
        <StatCard label="Effective hours" value={minutesToDuration(calendar?.summary?.effectiveMinutes || 0)} hint="Total this month" icon={Clock} tone="blue" />
        <StatCard label="Overtime" value={minutesToDuration(calendar?.summary?.overtimeMinutes || 0)} hint="Total this month" icon={TrendingUp} tone="indigo" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Attendance calendar" description={monthLabel(month)} />
          <div className="p-5">
            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {weekDays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {calendarCells.map((day, index) =>
                day ? (
                  <div
                    key={day.date}
                    className={cn(
                      'min-h-[64px] rounded-lg border p-1.5 text-left',
                      day.status ? statusColor(day.status) : 'border-slate-200 bg-white',
                      day.isFuture && 'opacity-50',
                    )}
                    title={`${day.date}${day.holiday ? ` · ${day.holiday}` : ''}`}
                  >
                    <p className="text-xs font-semibold">{new Date(day.date).getDate()}</p>
                    <p className="mt-0.5 text-[10px] leading-tight">{ATTENDANCE_STATUS_LABELS[day.status] || '—'}</p>
                    {day.checkIn ? (
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {formatTime(day.checkIn)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div key={`empty-${index}`} />
                ),
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-500">
              {['PRESENT', 'LATE', 'HALF_DAY', 'WFH', 'ABSENT', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF'].map((status) => (
                <span key={status} className="flex items-center gap-1">
                  <span className={cn('h-2.5 w-2.5 rounded-full', statusColor(status))} /> {ATTENDANCE_STATUS_LABELS[status]}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Month summary" description={monthLabel(month)} />
          <div className="space-y-2.5 p-5 text-sm">
            {[
              ['Present', calendar?.summary?.present],
              ['Late', calendar?.summary?.late],
              ['Half days', calendar?.summary?.halfDay],
              ['Absent', calendar?.summary?.absent],
              ['On leave', calendar?.summary?.onLeave],
              ['Work from home', calendar?.summary?.wfh],
              ['Holidays', calendar?.summary?.holidays],
              ['Weekly offs', calendar?.summary?.weeklyOffs],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-slate-600">{label}</span>
                <span className="font-semibold text-slate-900">{value ?? 0}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Attendance history" description={`${history.pagination?.total ?? 0} records for ${monthLabel(month)}`} />
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check in</th>
                <th>Check out</th>
                <th>Breaks</th>
                <th>Effective</th>
                <th>Overtime</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(history.items || []).map((row) => (
                <tr key={row._id}>
                  <td>{formatDate(row.date)}</td>
                  <td>{formatTime(row.checkIn)}</td>
                  <td>{formatTime(row.checkOut)}</td>
                  <td>
                    {row.breaks?.length || 0} · {minutesToDuration(row.breakMinutes)}
                  </td>
                  <td>{minutesToDuration(row.effectiveMinutes)}</td>
                  <td>{minutesToDuration(row.overtimeMinutes)}</td>
                  <td>
                    <StatusBadge status={row.status} labels={ATTENDANCE_STATUS_LABELS} />
                  </td>
                </tr>
              ))}
              {!(history.items || []).length ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-500">
                    No attendance records for this month.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={correctionModal}
        onClose={() => setCorrectionModal(false)}
        title="Request attendance correction"
        description="Corrections are reviewed and approved by HR. Your original records are preserved in the audit trail."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCorrectionModal(false)}>
              Cancel
            </button>
            <button type="submit" form="correction-form" className="btn btn-primary" disabled={busy}>
              Submit request
            </button>
          </>
        }
      >
        <form id="correction-form" onSubmit={submitCorrection} className="space-y-4">
          <Input
            label="Date"
            type="date"
            required
            value={correction.date}
            onChange={(event) => setCorrection({ ...correction, date: event.target.value })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Requested check in"
              type="time"
              value={correction.checkIn}
              onChange={(event) => setCorrection({ ...correction, checkIn: event.target.value })}
            />
            <Input
              label="Requested check out"
              type="time"
              value={correction.checkOut}
              onChange={(event) => setCorrection({ ...correction, checkOut: event.target.value })}
            />
          </div>
          <Textarea
            label="Reason"
            required
            rows={3}
            placeholder="Explain why the attendance needs correction"
            value={correction.reason}
            onChange={(event) => setCorrection({ ...correction, reason: event.target.value })}
          />
          <p className="text-xs text-slate-500">At least one of check-in or check-out time is required.</p>
        </form>
      </Modal>
    </div>
  );
};

export default MyAttendancePage;
