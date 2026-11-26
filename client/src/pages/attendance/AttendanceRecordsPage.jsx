import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Download, FileSpreadsheet, FileText, Search, Pencil, Clock, CalendarDays, UserCheck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import Modal from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Field';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { attendanceService } from '../../services/attendance.service';
import { departmentService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import { ATTENDANCE_STATUS_LABELS, EMPLOYMENT_STATUS_LABELS } from '../../utils/constants';
import { formatDate, formatTime, minutesToDuration, monthLabel, currentMonth } from '../../utils/format';

const toTimeInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const AttendanceRecordsPage = () => {
  const dispatch = useDispatch();
  const [filters, setFilters] = useState({ month: currentMonth(), department: '', status: '', search: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ checkIn: '', checkOut: '', status: '', notes: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await attendanceService.list({ ...filters, page, limit: 25 });
      setData(result);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    departmentService
      .list({ limit: 100 })
      .then((res) => setDepartments(res.items || []))
      .catch(() => {});
    attendanceService
      .summary({ department: filters.department || undefined })
      .then(setSummary)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.department]);

  const openEdit = (row) => {
    setEditing(row);
    setEditForm({
      checkIn: toTimeInput(row.checkIn),
      checkOut: toTimeInput(row.checkOut),
      status: row.status,
      notes: row.notes || '',
    });
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      const payload = {
        status: editForm.status || undefined,
        notes: editForm.notes || undefined,
      };
      if (editing.date) {
        if (editForm.checkIn) payload.checkIn = new Date(`${editing.date}T${editForm.checkIn}`).toISOString();
        if (editForm.checkOut) payload.checkOut = new Date(`${editing.date}T${editForm.checkOut}`).toISOString();
      }
      await attendanceService.correct(editing._id, payload);
      dispatch(toast('Attendance corrected and audited'));
      setEditing(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const exportAs = async (format) => {
    try {
      await attendanceService.export({ ...filters, format });
      dispatch(toast(`Attendance exported as ${format.toUpperCase()}`));
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : 'Employee'} />
          <div>
            <p className="font-medium text-slate-900">
              {row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : '—'}
            </p>
            <p className="text-xs text-slate-500">
              {row.employee?.employeeId} · {row.employee?.department?.name || '—'}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
    { key: 'checkIn', header: 'Check in', render: (row) => formatTime(row.checkIn) },
    { key: 'checkOut', header: 'Check out', render: (row) => formatTime(row.checkOut) },
    {
      key: 'breaks',
      header: 'Break',
      render: (row) => `${row.breaks?.length || 0} · ${minutesToDuration(row.breakMinutes)}`,
    },
    { key: 'effectiveMinutes', header: 'Effective', render: (row) => minutesToDuration(row.effectiveMinutes) },
    { key: 'overtimeMinutes', header: 'Overtime', render: (row) => minutesToDuration(row.overtimeMinutes) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div>
          <StatusBadge status={row.status} labels={ATTENDANCE_STATUS_LABELS} />
          {row.source === 'CORRECTION' ? <p className="mt-0.5 text-[10px] text-slate-400">Corrected</p> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(row)}>
          <Pencil size={13} /> Correct
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Attendance records"
        description="Organization-wide attendance with break details, effective hours and overtime."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Attendance records' }]}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => exportAs('xlsx')}>
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => exportAs('csv')}>
              <Download size={15} /> CSV
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => exportAs('pdf')}>
              <FileText size={15} /> PDF
            </button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Employees tracked" value={summary?.totalEmployees ?? 0} hint={formatDate(summary?.date)} icon={UserCheck} tone="navy" />
        <StatCard label="Present" value={summary?.present ?? 0} hint={`${summary?.late ?? 0} late`} icon={Clock} tone="emerald" />
        <StatCard label="On leave" value={summary?.onLeave ?? 0} hint={`${summary?.notMarked ?? 0} not marked`} icon={CalendarDays} tone="indigo" />
        <StatCard label="Effective hours" value={minutesToDuration(summary?.effectiveMinutes || 0)} hint="Across present employees" icon={Clock} tone="blue" />
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 p-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field pl-9"
              placeholder="Search employee name or ID"
              value={filters.search}
              onChange={(event) => {
                setPage(1);
                setFilters({ ...filters, search: event.target.value });
              }}
            />
          </div>
          <input
            type="month"
            className="field"
            value={filters.month}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, month: event.target.value });
            }}
          />
          <Select
            placeholder="All departments"
            value={filters.department}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, department: event.target.value });
            }}
            options={departments.map((dept) => ({ value: dept._id, label: dept.name }))}
          />
          <Select
            placeholder="All statuses"
            value={filters.status}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, status: event.target.value });
            }}
            options={Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            className="md:col-span-4"
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Records" description={`${data.pagination?.total ?? 0} entries · ${monthLabel(filters.month)}`} />
        <DataTable
          columns={columns}
          rows={data.items}
          loading={loading}
          pagination={data.pagination}
          onPageChange={setPage}
          emptyTitle="No attendance records"
          emptyDescription="No records match the selected filters for this period."
        />
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Correct attendance"
        description={
          editing?.employee
            ? `${editing.employee.firstName} ${editing.employee.lastName} · ${formatDate(editing.date)}`
            : ''
        }
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={busy}>
              Save correction
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Check in" type="time" value={editForm.checkIn} onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })} />
            <Input label="Check out" type="time" value={editForm.checkOut} onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })} />
          </div>
          <Select
            label="Attendance status"
            value={editForm.status}
            onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}
            options={Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Textarea
            label="Reason / notes"
            rows={3}
            value={editForm.notes}
            onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
          />
          <p className="text-xs text-slate-500">
            Working hours and overtime are recalculated on the server from the corrected timestamps. Original events
            remain stored in the attendance audit trail.
          </p>
        </div>
      </Modal>

      <p className="mt-3 text-xs text-slate-400">
        Status legend: {Object.values(EMPLOYMENT_STATUS_LABELS).length ? 'effective hours subtract all approved breaks.' : ''}
      </p>
    </div>
  );
};

export default AttendanceRecordsPage;
