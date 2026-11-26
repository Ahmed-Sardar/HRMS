import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { CalendarDays, Download, FileSpreadsheet, Plus, XCircle } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Input, Select, Textarea, Checkbox } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { leaveService } from '../../services/leave.service';
import { employeeService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import { LEAVE_STATUS_LABELS } from '../../utils/constants';
import { formatDate, formatEnum } from '../../utils/format';

const emptyRequest = {
  leaveType: '',
  startDate: '',
  endDate: '',
  isHalfDay: false,
  halfDaySession: 'FIRST_HALF',
  reason: '',
  contactDuringLeave: '',
  handoverTo: '',
};

const MyLeavePage = () => {
  const dispatch = useDispatch();
  const [balance, setBalance] = useState(null);
  const [types, setTypes] = useState([]);
  const [leaves, setLeaves] = useState({ items: [], pagination: null });
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyRequest);
  const [colleagues, setColleagues] = useState([]);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [balanceData, leavesData] = await Promise.all([
        leaveService.myBalance(),
        leaveService.myLeaves({ status: statusFilter || undefined, page, limit: 20 }),
      ]);
      setBalance(balanceData);
      setLeaves(leavesData);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    leaveService.types().then(setTypes).catch(() => {});
    employeeService.options().then(setColleagues).catch(() => {});
  }, []);

  const apply = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await leaveService.apply({
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.isHalfDay ? form.startDate : form.endDate,
        isHalfDay: form.isHalfDay,
        halfDaySession: form.isHalfDay ? form.halfDaySession : undefined,
        reason: form.reason,
        contactDuringLeave: form.contactDuringLeave || undefined,
        handoverTo: form.handoverTo || undefined,
      });
      dispatch(toast('Leave request submitted'));
      setModal(false);
      setForm(emptyRequest);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (leave) => {
    setCancelling(leave._id);
    try {
      await leaveService.cancel(leave._id);
      dispatch(toast('Leave request cancelled'));
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setCancelling(null);
    }
  };

  const exportAs = async (format) => {
    try {
      await leaveService.export({ status: statusFilter || undefined, format });
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const columns = [
    {
      key: 'leaveType',
      header: 'Type',
      render: (row) => <span className="font-medium text-slate-800">{formatEnum(row.leaveType)}</span>,
    },
    { key: 'period', header: 'Period', render: (row) => `${formatDate(row.startDate)} - ${formatDate(row.endDate)}` },
    {
      key: 'totalDays',
      header: 'Days',
      render: (row) => (
        <span>
          {row.totalDays}
          {row.isHalfDay ? <span className="ml-1 text-xs text-slate-500">(half)</span> : null}
        </span>
      ),
    },
    { key: 'reason', header: 'Reason', render: (row) => <span className="line-clamp-2 max-w-xs">{row.reason}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} labels={LEAVE_STATUS_LABELS} /> },
    {
      key: 'review',
      header: 'Review',
      render: (row) =>
        row.reviewedBy ? (
          <div className="text-xs text-slate-500">
            <p>{row.reviewedBy.name}</p>
            {row.reviewComment ? <p className="italic">“{row.reviewComment}”</p> : null}
          </div>
        ) : (
          <span className="text-xs text-slate-400">Awaiting review</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.status === 'PENDING' ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={cancelling === row._id}
            onClick={() => cancel(row)}
          >
            <XCircle size={13} /> Cancel
          </button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="My leave"
        description="Apply for leave, track balances and follow approval progress."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'My leave' }]}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => exportAs('xlsx')}>
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => exportAs('csv')}>
              <Download size={15} /> CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setModal(true)}>
              <Plus size={16} /> Apply for leave
            </button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(balance?.balances || []).map((item) => (
          <Card key={item.type} className="p-4">
            <p className="stat-label">{item.name}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{item.available}</p>
            <p className="text-xs text-slate-500">
              of {item.allocated} allocated · {item.used} used
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-navy-700"
                style={{ width: `${item.allocated ? Math.min(100, (item.available / item.allocated) * 100) : 0}%` }}
              />
            </div>
          </Card>
        ))}
        {!(balance?.balances || []).length ? (
          <Card className="p-4 sm:col-span-2 lg:col-span-4">
            <p className="text-sm text-slate-500">No leave balance configured. Contact HR.</p>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader
          title="Leave requests"
          description={`Year ${balance?.year || new Date().getFullYear()}`}
          actions={
            <select className="field w-auto" value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}>
              <option value="">All statuses</option>
              {Object.entries(LEAVE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          }
        />
        <DataTable
          columns={columns}
          rows={leaves.items}
          loading={loading}
          pagination={leaves.pagination}
          onPageChange={setPage}
          emptyTitle="No leave requests"
          emptyDescription="Apply for leave and it will appear here with its approval status."
          emptyAction={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal(true)}>
              <CalendarDays size={14} /> Apply for leave
            </button>
          }
        />
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Apply for leave"
        description="Weekends and holidays are excluded from the payable day count."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button type="submit" form="leave-form" className="btn btn-primary" disabled={busy}>
              Submit request
            </button>
          </>
        }
      >
        <form id="leave-form" onSubmit={apply} className="space-y-4">
          <Select
            label="Leave type"
            required
            placeholder="Select leave type"
            value={form.leaveType}
            onChange={(event) => setForm({ ...form, leaveType: event.target.value })}
            options={types.map((type) => ({
              value: type.code,
              label: `${type.name}${type.annualQuota ? ` (${type.annualQuota} days)` : ''}`,
            }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={form.isHalfDay ? 'Leave date' : 'Start date'}
              type="date"
              required
              value={form.startDate}
              onChange={(event) => setForm({ ...form, startDate: event.target.value })}
            />
            {!form.isHalfDay ? (
              <Input
                label="End date"
                type="date"
                required
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
              />
            ) : (
              <Select
                label="Half day session"
                value={form.halfDaySession}
                onChange={(event) => setForm({ ...form, halfDaySession: event.target.value })}
                options={[
                  { value: 'FIRST_HALF', label: 'First half' },
                  { value: 'SECOND_HALF', label: 'Second half' },
                ]}
              />
            )}
          </div>
          <Checkbox
            label="This is a half-day leave"
            checked={form.isHalfDay}
            onChange={(event) => setForm({ ...form, isHalfDay: event.target.checked })}
          />
          <Textarea
            label="Reason"
            required
            rows={3}
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Handover to"
              placeholder="Optional"
              value={form.handoverTo}
              onChange={(event) => setForm({ ...form, handoverTo: event.target.value })}
              options={colleagues.map((item) => ({ value: item.value, label: item.label }))}
            />
            <Input
              label="Contact during leave"
              placeholder="Phone or email"
              value={form.contactDuringLeave}
              onChange={(event) => setForm({ ...form, contactDuringLeave: event.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MyLeavePage;
