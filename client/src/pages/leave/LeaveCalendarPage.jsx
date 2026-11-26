import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { CalendarDays } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Select } from '../../components/ui/Field';
import { PageLoader } from '../../components/ui/Loader';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { leaveService } from '../../services/leave.service';
import { departmentService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import { currentMonth, formatDate, monthLabel } from '../../utils/format';

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const LeaveCalendarPage = () => {
  const dispatch = useDispatch();
  const [month, setMonth] = useState(currentMonth());
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await leaveService.calendar({ month, department: department || undefined });
      setData(result);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [department, dispatch, month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    departmentService
      .list({ limit: 100 })
      .then((res) => setDepartments(res.items || []))
      .catch(() => {});
  }, []);

  const calendar = useMemo(() => {
    if (!month) return [];
    const [year, monthIndex] = month.split('-').map(Number);
    const totalDays = new Date(year, monthIndex, 0).getDate();
    const firstWeekday = new Date(year, monthIndex - 1, 1).getDay();
    const days = Array.from({ length: totalDays }).map((_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, '0')}`;
      const leaves = (data?.leaves || []).filter((leave) => (leave.dates || []).includes(date));
      const holiday = (data?.holidays || []).find((item) => String(item.date).slice(0, 10) === date);
      return {
        date,
        dayNumber: index + 1,
        weekday: new Date(date).getDay(),
        leaves,
        holiday,
      };
    });
    return [...Array.from({ length: firstWeekday }).map(() => null), ...days];
  }, [data, month]);

  return (
    <div>
      <PageHeader
        title="Team leave calendar"
        description="See who is away this month. Pending requests are included so planning stays realistic."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Team calendar' }]}
        actions={
          <>
            <input type="month" className="field w-auto" value={month} onChange={(event) => setMonth(event.target.value)} />
            <Select
              placeholder="All departments"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              options={departments.map((dept) => ({ value: dept._id, label: dept.name }))}
              className="w-48"
            />
          </>
        }
      />

      {loading && !data ? <PageLoader label="Loading calendar..." /> : null}

      {data ? (
        <div className="grid gap-4 xl:grid-cols-4">
          <Card className="xl:col-span-3">
            <CardHeader title={monthLabel(month)} description="Leave bookings and public holidays" />
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {weekDays.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {calendar.map((day, index) =>
                  day ? (
                    <div
                      key={day.date}
                      className={`min-h-[92px] rounded-lg border p-1.5 ${
                        day.holiday
                          ? 'border-violet-200 bg-violet-50'
                          : day.weekday === 0 || day.weekday === 6
                            ? 'border-slate-200 bg-slate-50'
                            : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">{day.dayNumber}</span>
                        {day.holiday ? <span className="text-[9px] font-semibold text-violet-700">HOLIDAY</span> : null}
                      </div>
                      {day.holiday ? <p className="mt-0.5 text-[10px] leading-tight text-violet-700">{day.holiday.name}</p> : null}
                      <div className="mt-1 space-y-0.5">
                        {day.leaves.slice(0, 3).map((leave) => (
                          <p
                            key={`${leave._id}-${day.date}`}
                            className={`truncate rounded px-1 text-[10px] ${
                              leave.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}
                            title={`${leave.employee?.firstName || ''} ${leave.employee?.lastName || ''} · ${leave.status}`}
                          >
                            {leave.employee?.firstName || 'Employee'} {leave.employee?.lastName?.charAt(0) || ''}.
                          </p>
                        ))}
                        {day.leaves.length > 3 ? (
                          <p className="px-1 text-[10px] text-slate-500">+{day.leaves.length - 3} more</p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div key={`empty-${index}`} />
                  ),
                )}
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Leave requests" description={`${data.leaves?.length || 0} in this month`} />
              <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {(data.leaves || []).length ? (
                  data.leaves.map((leave) => (
                    <div key={leave._id} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800">
                          {leave.employee?.firstName} {leave.employee?.lastName}
                        </p>
                        <StatusBadge status={leave.status} />
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatDate(leave.startDate)} - {formatDate(leave.endDate)} · {leave.totalDays} day(s)
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="px-4 py-6 text-sm text-slate-500">No leave booked this month.</p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Holidays" description="Public and company holidays" />
              <div className="divide-y divide-slate-100">
                {(data.holidays || []).length ? (
                  data.holidays.map((holiday) => (
                    <div key={holiday._id} className="flex items-center justify-between px-4 py-2.5">
                      <p className="text-sm text-slate-700">{holiday.name}</p>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <CalendarDays size={12} /> {formatDate(holiday.date)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="px-4 py-6 text-sm text-slate-500">No holidays this month.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LeaveCalendarPage;
