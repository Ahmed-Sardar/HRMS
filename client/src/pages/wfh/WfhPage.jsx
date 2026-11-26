import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { CalendarClock, Download, FileSpreadsheet, Home, Plus, ShieldCheck, XCircle } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import StatCard from '../../components/ui/StatCard';
import Alert from '../../components/ui/Alert';
import { toast } from '../../store/uiSlice';
import { wfhService } from '../../services/wfh.service';
import { employeeService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import useAuth from '../../hooks/useAuth';
import { WFH_MODE_LABELS, WFH_STATUS_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/format';

const emptyRequest = {
  workMode: 'WFH',
  dayType: 'FULL_DAY',
  halfDaySession: 'FIRST_HALF',
  startDate: '',
  endDate: '',
  workLocation: '',
  contactNumber: '',
  reason: '',
  handoverTo: '',
};

const WfhPage = () => {
  const dispatch = useDispatch();
  const { role } = useAuth();
  const canApprove = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(role);

  const [policy, setPolicy] = useState(null);
  const [myRequests, setMyRequests] = useState({ items: [], pagination: null });
  const [teamRequests, setTeamRequests] = useState({ items: [], pagination: null });
  const [tab, setTab] = useState('my');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [form, setForm] = useState(emptyRequest);
  const [busy, setBusy] = useState(false);
  const [colleagues, setColleagues] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  const loadPolicy = useCallback(async () => {
    try {
      setPolicy(await wfhService.policy());
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  }, [dispatch]);

  const loadMine = useCallback(async () => {
    setLoading(true);
    try {
      setMyRequests(await wfhService.my({ status: statusFilter || undefined, page, limit: 15 }));
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, page, statusFilter]);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      setTeamRequests(await wfhService.list({ status: statusFilter || undefined, page, limit: 15 }));
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, page, statusFilter]);

  useEffect(() => {
    loadPolicy();
    employeeService.options().then(setColleagues).catch(() => {});
  }, [loadPolicy]);

  useEffect(() => {
    if (tab === 'my' || !canApprove) loadMine();
    else loadTeam();
  }, [tab, canApprove, loadMine, loadTeam]);

  const apply = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await wfhService.apply({
        workMode: form.workMode,
        dayType: form.dayType,
        halfDaySession: form.dayType === 'HALF_DAY' ? form.halfDaySession : undefined,
        startDate: form.startDate,
        endDate: form.dayType === 'HALF_DAY' ? form.startDate : form.endDate,
        workLocation: form.workLocation || undefined,
        contactNumber: form.contactNumber || undefined,
        handoverTo: form.handoverTo || undefined,
        reason: form.reason,
      });
      dispatch(toast('Work-from-home request submitted'));
      setApplyOpen(false);
      setForm(emptyRequest);
      await Promise.all([loadMine(), loadPolicy()]);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (row) => {
    try {
      await wfhService.cancel(row._id);
      dispatch(toast('Request cancelled'));
      await Promise.all([loadMine(), loadPolicy()]);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const submitReview = async (status) => {
    if (!reviewing) return;
    setReviewBusy(true);
    try {
      const result = await wfhService.review(reviewing._id, { status, reviewComment: reviewComment || undefined });
      dispatch(
        toast(
          result?.status === 'MANAGER_APPROVED'
            ? 'Recommended. Waiting for HR approval.'
            : `Request ${status === 'REJECTED' ? 'rejected' : 'approved'}`,
        ),
      );
      setReviewing(null);
      setReviewComment('');
      await Promise.all([loadTeam(), loadPolicy()]);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setReviewBusy(false);
    }
  };

  const exportAs = async (format) => {
    try {
      await wfhService.export({ status: statusFilter || undefined, format });
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const myColumns = useMemo(
    () => [
      {
        key: 'period',
        header: 'Period',
        render: (row) => (
          <div>
            <p className="font-medium text-slate-800">
              {formatDate(row.startDate)}
              {String(row.startDate).slice(0, 10) !== String(row.endDate).slice(0, 10) ? ` - ${formatDate(row.endDate)}` : ''}
            </p>
            <p className="text-xs text-slate-500">
              {WFH_MODE_LABELS[row.workMode] || row.workMode} · {row.dayType === 'HALF_DAY' ? 'Half day' : 'Full day'}
            </p>
          </div>
        ),
      },
      { key: 'totalDays', header: 'Days', render: (row) => <span className="font-medium">{row.totalDays}</span> },
      {
        key: 'workLocation',
        header: 'Location',
        render: (row) => <span className="text-sm text-slate-600">{row.workLocation || '-'}</span>,
      },
      { key: 'reason', header: 'Reason', render: (row) => <span className="line-clamp-2 max-w-xs text-sm">{row.reason}</span> },
      { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} labels={WFH_STATUS_LABELS} /> },
      {
        key: 'actions',
        header: '',
        render: (row) =>
          ['PENDING', 'MANAGER_APPROVED', 'APPROVED'].includes(row.status) ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => cancel(row)}>
              <XCircle size={13} /> Cancel
            </button>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const teamColumns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">
            {row.employee?.firstName} {row.employee?.lastName}
          </p>
          <p className="text-xs text-slate-500">
            {row.employee?.employeeId}
            {row.employee?.department?.name ? ` · ${row.employee.department.name}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      render: (row) => (
        <div>
          <p>{formatDate(row.startDate)} - {formatDate(row.endDate)}</p>
          <p className="text-xs text-slate-500">
            {row.totalDays} day(s) · {WFH_MODE_LABELS[row.workMode] || row.workMode}
          </p>
        </div>
      ),
    },
    { key: 'reason', header: 'Reason', render: (row) => <span className="line-clamp-2 max-w-xs text-sm">{row.reason}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} labels={WFH_STATUS_LABELS} /> },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        ['PENDING', 'MANAGER_APPROVED'].includes(row.status) ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setReviewing(row);
              setReviewComment('');
            }}
          >
            <ShieldCheck size={13} /> Review
          </button>
        ) : null,
    },
  ];

  const rows = tab === 'my' || !canApprove ? myRequests : teamRequests;
  const activeLoading = loading;

  return (
    <div>
      <PageHeader
        title="Work from home"
        description="Request remote working days, follow the approval chain and keep team coverage visible."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Work from home' }]}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => exportAs('xlsx')}>
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => exportAs('csv')}>
              <Download size={15} /> CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setApplyOpen(true)}>
              <Plus size={16} /> Request WFH
            </button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Monthly allowance"
          value={policy?.monthlyLimit ? `${policy.monthlyLimit} days` : 'No cap'}
          hint={policy?.month || 'Current month'}
          icon={Home}
          tone="indigo"
        />
        <StatCard label="Approved days" value={policy?.approvedDays ?? 0} hint="This month" icon={CalendarClock} tone="emerald" />
        <StatCard
          label="Remaining"
          value={policy?.remaining === null || policy?.remaining === undefined ? 'Unlimited' : policy.remaining}
          hint="Including pending requests"
          icon={ShieldCheck}
          tone="violet"
        />
        <StatCard
          label="Approval chain"
          value={policy?.requiresHrApproval ? 'Manager + HR' : 'Manager'}
          hint={policy?.maxAdvanceDays ? `Book up to ${policy.maxAdvanceDays} days ahead` : undefined}
          icon={ShieldCheck}
          tone="blue"
        />
      </div>

      {policy?.notes ? (
        <Alert tone="info" className="mb-4">
          {policy.notes}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Requests"
          description="Approved WFH days are marked in attendance automatically."
          actions={
            <select
              className="field w-auto"
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
            >
              <option value="">All statuses</option>
              {Object.entries(WFH_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          }
        />

        {canApprove ? (
          <div className="border-b border-white/70 px-4 py-3">
            <Tabs
              value={tab}
              onChange={(value) => {
                setTab(value);
                setPage(1);
              }}
              items={[
                { key: 'my', label: 'My requests' },
                { key: 'team', label: 'Team approvals' },
              ]}
            />
          </div>
        ) : null}

        <DataTable
          columns={tab === 'my' || !canApprove ? myColumns : teamColumns}
          rows={rows.items || []}
          loading={activeLoading}
          pagination={rows.pagination}
          onPageChange={setPage}
          emptyTitle={tab === 'team' ? 'No requests awaiting approval' : 'No work-from-home requests yet'}
          emptyDescription={
            tab === 'team'
              ? 'Employee work-from-home requests will appear here for review.'
              : 'Request a work-from-home day and it will appear here with its approval status.'
          }
          emptyAction={
            tab === 'my' || !canApprove ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setApplyOpen(true)}>
                <Plus size={14} /> Request WFH
              </button>
            ) : null
          }
        />
      </Card>

      <Modal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title="Request work from home"
        description="Weekends and company holidays are excluded from the requested days."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setApplyOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="wfh-form" className="btn btn-primary" disabled={busy}>
              Submit request
            </button>
          </>
        }
      >
        <form id="wfh-form" onSubmit={apply} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Work mode"
              value={form.workMode}
              onChange={(event) => setForm({ ...form, workMode: event.target.value })}
              options={Object.entries(WFH_MODE_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="Day type"
              value={form.dayType}
              onChange={(event) => setForm({ ...form, dayType: event.target.value })}
              options={[
                { value: 'FULL_DAY', label: 'Full day' },
                { value: 'HALF_DAY', label: 'Half day' },
              ]}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={form.dayType === 'HALF_DAY' ? 'Date' : 'Start date'}
              type="date"
              required
              value={form.startDate}
              onChange={(event) => setForm({ ...form, startDate: event.target.value })}
            />
            {form.dayType === 'HALF_DAY' ? (
              <Select
                label="Session"
                value={form.halfDaySession}
                onChange={(event) => setForm({ ...form, halfDaySession: event.target.value })}
                options={[
                  { value: 'FIRST_HALF', label: 'First half' },
                  { value: 'SECOND_HALF', label: 'Second half' },
                ]}
              />
            ) : (
              <Input
                label="End date"
                type="date"
                required
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
              />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Work location"
              placeholder="Home address / city"
              value={form.workLocation}
              onChange={(event) => setForm({ ...form, workLocation: event.target.value })}
            />
            <Input
              label="Contact number"
              placeholder="Reachable number"
              value={form.contactNumber}
              onChange={(event) => setForm({ ...form, contactNumber: event.target.value })}
            />
          </div>
          <Select
            label="Handover to"
            placeholder="Optional"
            value={form.handoverTo}
            onChange={(event) => setForm({ ...form, handoverTo: event.target.value })}
            options={colleagues.map((item) => ({ value: item.value, label: item.label }))}
          />
          <Textarea
            label="Reason"
            required
            rows={3}
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
            placeholder="Describe the work you will be doing remotely"
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="Review request"
        description={
          reviewing
            ? `${reviewing.employee?.firstName || ''} ${reviewing.employee?.lastName || ''} · ${formatDate(reviewing.startDate)} to ${formatDate(reviewing.endDate)}`
            : ''
        }
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setReviewing(null)} disabled={reviewBusy}>
              Close
            </button>
            <button type="button" className="btn btn-danger" onClick={() => submitReview('REJECTED')} disabled={reviewBusy}>
              Reject
            </button>
            <button type="button" className="btn btn-primary" onClick={() => submitReview('APPROVED')} disabled={reviewBusy}>
              Approve
            </button>
          </>
        }
      >
        {reviewing ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/70 bg-white/60 p-4 text-sm text-slate-600">
              <p>
                <span className="font-medium text-slate-800">Reason:</span> {reviewing.reason}
              </p>
              <p className="mt-2">
                <span className="font-medium text-slate-800">Mode:</span> {WFH_MODE_LABELS[reviewing.workMode]} ·{' '}
                {reviewing.totalDays} day(s)
              </p>
              {reviewing.workLocation ? (
                <p className="mt-1">
                  <span className="font-medium text-slate-800">Location:</span> {reviewing.workLocation}
                </p>
              ) : null}
            </div>
            <Textarea
              label="Review comment"
              rows={3}
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Optional remarks shared with the employee"
            />
            {reviewing.status === 'PENDING' ? (
              <p className="text-xs text-slate-500">
                Approving records the manager recommendation. HR approval is the final step when the policy requires it.
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default WfhPage;
