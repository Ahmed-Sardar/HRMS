import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  BadgeCheck,
  CheckCircle2,
  Download,
  FileText,
  LogOut,
  ShieldCheck,
  Undo2,
  UserMinus,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import Alert from '../../components/ui/Alert';
import { toast } from '../../store/uiSlice';
import { exitService } from '../../services/exit.service';
import { employeeService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import useAuth from '../../hooks/useAuth';
import {
  CLEARANCE_LABELS,
  EXIT_STATUS_LABELS,
  EXIT_TYPE_LABELS,
} from '../../utils/constants';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';

const STAFF = ['SUPER_ADMIN', 'ADMIN', 'HR'];
const STEPS = ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'IN_PROGRESS', 'COMPLETED'];

const emptyResignation = { resignationDate: '', requestedLastWorkingDay: '', noticePeriodDays: 30, reason: '' };

const ExitPage = () => {
  const dispatch = useDispatch();
  const { role } = useAuth();
  const isStaff = STAFF.includes(role);
  const isFinance = role === 'FINANCE';

  const [tab, setTab] = useState('my');
  const [mine, setMine] = useState({ items: [], pagination: null });
  const [queue, setQueue] = useState({ items: [], pagination: null });
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);
  const [resignForm, setResignForm] = useState(emptyResignation);
  const [initiateOpen, setInitiateOpen] = useState(false);
  const [initiateForm, setInitiateForm] = useState({ employee: '', exitType: 'TERMINATION', approvedLastWorkingDay: '', reason: '' });
  const [employees, setEmployees] = useState([]);
  const [review, setReview] = useState({ decision: 'APPROVED', comment: '', approvedLastWorkingDay: '' });
  const [interview, setInterview] = useState({ scheduledAt: '', done: false, feedback: '', rating: 5 });
  const [settlementForm, setSettlementForm] = useState({ bonus: 0, otherDeductions: 0, notes: '' });
  const [busy, setBusy] = useState(false);

  const loadMine = useCallback(async () => {
    setLoading(true);
    try {
      setMine(await exitService.my({ page, limit: 10 }));
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, page]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await exitService.list({ status: statusFilter || undefined, page, limit: 15 }));
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, page, statusFilter]);

  useEffect(() => {
    if (tab === 'queue') loadQueue();
    else loadMine();
  }, [tab, loadMine, loadQueue]);

  useEffect(() => {
    if (isStaff) {
      employeeService.options().then(setEmployees).catch(() => {});
    }
  }, [isStaff]);

  const openDetail = async (id) => {
    try {
      const data = await exitService.get(id);
      setActive(data);
      setReview({ decision: 'APPROVED', comment: '', approvedLastWorkingDay: '' });
      setInterview({
        scheduledAt: data.exitInterview?.scheduledAt ? String(data.exitInterview.scheduledAt).slice(0, 16) : '',
        done: Boolean(data.exitInterview?.done),
        feedback: data.exitInterview?.feedback || '',
        rating: data.exitInterview?.rating || 5,
      });
      setSettlementForm({
        bonus: data.settlement?.bonus || 0,
        otherDeductions: data.settlement?.otherDeductions || 0,
        notes: data.settlement?.notes || '',
      });
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const refreshActive = async (id = active?._id) => {
    if (!id) return;
    try {
      setActive(await exitService.get(id));
    } catch {
      /* ignore refresh errors */
    }
  };

  const submitResignation = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await exitService.submit({
        resignationDate: resignForm.resignationDate || undefined,
        requestedLastWorkingDay: resignForm.requestedLastWorkingDay || undefined,
        noticePeriodDays: Number(resignForm.noticePeriodDays) || undefined,
        reason: resignForm.reason,
      });
      dispatch(toast('Resignation submitted'));
      setResignOpen(false);
      setResignForm(emptyResignation);
      await loadMine();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const initiateExit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await exitService.initiate({
        employee: initiateForm.employee,
        exitType: initiateForm.exitType,
        approvedLastWorkingDay: initiateForm.approvedLastWorkingDay,
        reason: initiateForm.reason,
      });
      dispatch(toast('Exit initiated'));
      setInitiateOpen(false);
      setInitiateForm({ employee: '', exitType: 'TERMINATION', approvedLastWorkingDay: '', reason: '' });
      await loadQueue();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!active) return;
    try {
      await exitService.withdraw(active._id);
      dispatch(toast('Resignation withdrawn'));
      await Promise.all([refreshActive(), loadMine()]);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const submitReview = async (stage) => {
    if (!active) return;
    setDetailBusy(true);
    try {
      if (stage === 'manager') {
        await exitService.managerReview(active._id, { decision: review.decision, comment: review.comment || undefined });
      } else {
        await exitService.hrReview(active._id, {
          decision: review.decision,
          comment: review.comment || undefined,
          approvedLastWorkingDay: review.approvedLastWorkingDay || undefined,
        });
      }
      dispatch(toast(`Resignation ${review.decision.toLowerCase()}`));
      await Promise.all([refreshActive(), tab === 'queue' ? loadQueue() : loadMine()]);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setDetailBusy(false);
    }
  };

  const updateClearance = async (department, status) => {
    if (!active) return;
    setDetailBusy(true);
    try {
      await exitService.clearance(active._id, { department, status });
      dispatch(toast(`${CLEARANCE_LABELS[department]} clearance updated`));
      await refreshActive();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setDetailBusy(false);
    }
  };

  const markAssetReturned = async (assetId) => {
    if (!active) return;
    setDetailBusy(true);
    try {
      await exitService.assetReturn(active._id, assetId, { returned: true, condition: 'GOOD' });
      dispatch(toast('Asset marked returned'));
      await refreshActive();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setDetailBusy(false);
    }
  };

  const saveInterview = async () => {
    if (!active) return;
    setDetailBusy(true);
    try {
      await exitService.interview(active._id, {
        scheduledAt: interview.scheduledAt || undefined,
        done: interview.done,
        feedback: interview.feedback || undefined,
        rating: Number(interview.rating) || undefined,
      });
      dispatch(toast('Exit interview saved'));
      await refreshActive();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setDetailBusy(false);
    }
  };

  const computeSettlement = async () => {
    if (!active) return;
    setDetailBusy(true);
    try {
      await exitService.saveSettlement(active._id, {
        bonus: Number(settlementForm.bonus) || 0,
        otherDeductions: Number(settlementForm.otherDeductions) || 0,
        notes: settlementForm.notes || undefined,
      });
      dispatch(toast('Settlement computed'));
      await refreshActive();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setDetailBusy(false);
    }
  };

  const approveSettlement = async (status) => {
    if (!active) return;
    setDetailBusy(true);
    try {
      await exitService.approveSettlement(active._id, { status });
      dispatch(toast(`Settlement ${status.toLowerCase()}`));
      await refreshActive();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setDetailBusy(false);
    }
  };

  const completeExit = async () => {
    if (!active) return;
    setDetailBusy(true);
    try {
      await exitService.complete(active._id, {});
      dispatch(toast('Exit completed'));
      await Promise.all([refreshActive(), tab === 'queue' ? loadQueue() : loadMine()]);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setDetailBusy(false);
    }
  };

  const downloadLetter = async (type) => {
    if (!active) return;
    try {
      await exitService.letter(active._id, type);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const canReviewManager = active?.status === 'PENDING_MANAGER' && (isStaff || tab === 'queue');
  const canReviewHr = active?.status === 'PENDING_HR' && isStaff;
  const queueColumns = [
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
            {row.employee?.designation?.title ? ` · ${row.employee.designation.title}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'exitType', header: 'Type', render: (row) => EXIT_TYPE_LABELS[row.exitType] || row.exitType },
    {
      key: 'dates',
      header: 'Last working day',
      render: (row) => (
        <div>
          <p className="text-sm">{formatDate(row.approvedLastWorkingDay || row.requestedLastWorkingDay)}</p>
          <p className="text-xs text-slate-500">Raised {formatDate(row.resignationDate)}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} labels={EXIT_STATUS_LABELS} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openDetail(row._id)}>
          Open
        </button>
      ),
    },
  ];

  const rows = tab === 'queue' ? queue : mine;
  const stepsDone = (status) => STEPS.indexOf(status);
  const activeStep = active ? stepsDone(active.status) : -1;

  return (
    <div>
      <PageHeader
        title="Employee exit & offboarding"
        description="Resignations, approvals, department clearances, asset returns, settlement and letters in one audited workflow."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Exit management' }]}
        actions={
          <>
            {isStaff ? (
              <button type="button" className="btn btn-secondary" onClick={() => setInitiateOpen(true)}>
                <UserMinus size={15} /> Initiate exit
              </button>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => setResignOpen(true)}>
              <LogOut size={16} /> Submit resignation
            </button>
          </>
        }
      />

      <Card>
        <CardHeader
          title="Exit records"
          description="Employee records are retained after separation for payroll and audit history."
          actions={
            tab === 'queue' ? (
              <select
                className="field w-auto"
                value={statusFilter}
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(event.target.value);
                }}
              >
                <option value="">All statuses</option>
                {Object.entries(EXIT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            ) : null
          }
        />

        <div className="border-b border-white/70 px-4 py-3">
          <Tabs
            value={tab}
            onChange={(value) => {
              setTab(value);
              setPage(1);
            }}
            items={[
              { key: 'my', label: 'My exit' },
              { key: 'queue', label: 'Exit queue' },
            ]}
          />
        </div>

        <DataTable
          columns={tab === 'queue' ? queueColumns : [
            { key: 'exitType', header: 'Type', render: (row) => EXIT_TYPE_LABELS[row.exitType] },
            {
              key: 'dates',
              header: 'Last working day',
              render: (row) => (
                <div>
                  <p>{formatDate(row.approvedLastWorkingDay || row.requestedLastWorkingDay)}</p>
                  <p className="text-xs text-slate-500">Raised {formatDate(row.resignationDate)}</p>
                </div>
              ),
            },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} labels={EXIT_STATUS_LABELS} /> },
            {
              key: 'actions',
              header: '',
              render: (row) => (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openDetail(row._id)}>
                  View
                </button>
              ),
            },
          ]}
          rows={rows.items || []}
          loading={loading}
          pagination={rows.pagination}
          onPageChange={setPage}
          emptyTitle={tab === 'queue' ? 'No exit records' : 'No resignation on record'}
          emptyDescription={
            tab === 'queue'
              ? 'Resignations and initiated exits will appear here.'
              : 'Submit a resignation to start the offboarding workflow.'
          }
        />
      </Card>

      <Modal
        open={resignOpen}
        onClose={() => setResignOpen(false)}
        title="Submit resignation"
        description="Your reporting manager and HR are notified. You can withdraw before HR approval."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setResignOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="resign-form" className="btn btn-danger" disabled={busy}>
              Submit resignation
            </button>
          </>
        }
      >
        <form id="resign-form" onSubmit={submitResignation} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Resignation date"
              type="date"
              value={resignForm.resignationDate}
              onChange={(event) => setResignForm({ ...resignForm, resignationDate: event.target.value })}
              hint="Defaults to today"
            />
            <Input
              label="Requested last working day"
              type="date"
              value={resignForm.requestedLastWorkingDay}
              onChange={(event) => setResignForm({ ...resignForm, requestedLastWorkingDay: event.target.value })}
              hint="HR confirms the final date"
            />
          </div>
          <Input
            label="Notice period (days)"
            type="number"
            min="0"
            value={resignForm.noticePeriodDays}
            onChange={(event) => setResignForm({ ...resignForm, noticePeriodDays: event.target.value })}
          />
          <Textarea
            label="Reason for resignation"
            required
            rows={4}
            value={resignForm.reason}
            onChange={(event) => setResignForm({ ...resignForm, reason: event.target.value })}
          />
        </form>
      </Modal>

      <Modal
        open={initiateOpen}
        onClose={() => setInitiateOpen(false)}
        title="Initiate an exit"
        description="Use for termination, retirement or absconding. The employee is moved to notice period."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setInitiateOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="initiate-form" className="btn btn-danger" disabled={busy}>
              Initiate exit
            </button>
          </>
        }
      >
        <form id="initiate-form" onSubmit={initiateExit} className="space-y-4">
          <Select
            label="Employee"
            required
            placeholder="Select employee"
            value={initiateForm.employee}
            onChange={(event) => setInitiateForm({ ...initiateForm, employee: event.target.value })}
            options={employees}
          />
          <Select
            label="Exit type"
            value={initiateForm.exitType}
            onChange={(event) => setInitiateForm({ ...initiateForm, exitType: event.target.value })}
            options={[
              { value: 'TERMINATION', label: 'Termination' },
              { value: 'RETIREMENT', label: 'Retirement' },
              { value: 'ABSCONDING', label: 'Absconding' },
            ]}
          />
          <Input
            label="Last working day"
            type="date"
            required
            value={initiateForm.approvedLastWorkingDay}
            onChange={(event) => setInitiateForm({ ...initiateForm, approvedLastWorkingDay: event.target.value })}
          />
          <Textarea
            label="Reason"
            required
            rows={3}
            value={initiateForm.reason}
            onChange={(event) => setInitiateForm({ ...initiateForm, reason: event.target.value })}
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        size="xl"
        title={active ? `${active.employee?.firstName || ''} ${active.employee?.lastName || ''}` : 'Exit record'}
        description={
          active
            ? `${active.employee?.employeeId || ''} · ${EXIT_TYPE_LABELS[active.exitType]} · raised ${formatDate(active.resignationDate)}`
            : ''
        }
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setActive(null)}>
            Close
          </button>
        }
      >
        {active ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={active.status} labels={EXIT_STATUS_LABELS} />
              <span className="chip">Requested LWD: {formatDate(active.requestedLastWorkingDay)}</span>
              {active.approvedLastWorkingDay ? (
                <span className="chip bg-emerald-50 text-emerald-700">Approved LWD: {formatDate(active.approvedLastWorkingDay)}</span>
              ) : null}
              <span className="chip">Notice: {active.noticePeriodDays} days</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-5">
              {STEPS.map((step, index) => (
                <div
                  key={step}
                  className={`rounded-xl border px-3 py-2 text-center text-[11px] font-semibold ${
                    active.status === 'COMPLETED' || index <= activeStep
                      ? 'border-navy-200/70 bg-navy-50/80 text-navy-700'
                      : 'border-white/70 bg-white/50 text-slate-400'
                  }`}
                >
                  {EXIT_STATUS_LABELS[step]}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/70 bg-white/60 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Reason</p>
              <p className="mt-1 whitespace-pre-wrap">{active.reason}</p>
              {active.managerReview?.comment ? (
                <p className="mt-2 text-xs">Manager: {active.managerReview.comment}</p>
              ) : null}
              {active.hrReview?.comment ? <p className="text-xs">HR: {active.hrReview.comment}</p> : null}
            </div>

            {(canReviewManager || canReviewHr) && (
              <div className="space-y-3 rounded-xl border border-navy-200/60 bg-navy-50/50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <ShieldCheck size={15} /> {canReviewManager ? 'Manager review' : 'HR review'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="Decision"
                    value={review.decision}
                    onChange={(event) => setReview({ ...review, decision: event.target.value })}
                    options={[
                      { value: 'APPROVED', label: 'Approve' },
                      { value: 'REJECTED', label: 'Reject' },
                    ]}
                  />
                  {canReviewHr ? (
                    <Input
                      label="Approved last working day"
                      type="date"
                      value={review.approvedLastWorkingDay}
                      onChange={(event) => setReview({ ...review, approvedLastWorkingDay: event.target.value })}
                    />
                  ) : null}
                </div>
                <Textarea
                  label="Comment"
                  rows={2}
                  value={review.comment}
                  onChange={(event) => setReview({ ...review, comment: event.target.value })}
                />
                <button
                  type="button"
                  className={review.decision === 'REJECTED' ? 'btn btn-danger' : 'btn btn-primary'}
                  onClick={() => submitReview(canReviewManager ? 'manager' : 'hr')}
                  disabled={detailBusy}
                >
                  <CheckCircle2 size={15} /> Record {review.decision.toLowerCase()}
                </button>
              </div>
            )}

            {['PENDING_MANAGER', 'PENDING_HR'].includes(active.status) && tab === 'my' ? (
              <button type="button" className="btn btn-secondary" onClick={withdraw}>
                <Undo2 size={14} /> Withdraw resignation
              </button>
            ) : null}

            {['APPROVED', 'IN_PROGRESS', 'COMPLETED'].includes(active.status) ? (
              <>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Department clearances</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(active.clearances || []).map((item) => (
                      <div key={item._id || item.department} className="rounded-xl border border-white/70 bg-white/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-800">{CLEARANCE_LABELS[item.department]}</p>
                          <StatusBadge status={item.status} />
                        </div>
                        {item.remarks ? <p className="mt-1 text-xs text-slate-500">{item.remarks}</p> : null}
                        {isStaff || (isFinance && item.department === 'FINANCE') ? (
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              onClick={() => updateClearance(item.department, 'CLEARED')}
                              disabled={detailBusy || item.status === 'CLEARED' || active.status === 'COMPLETED'}
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => updateClearance(item.department, 'NOT_REQUIRED')}
                              disabled={detailBusy || active.status === 'COMPLETED'}
                            >
                              Not required
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Company assets</p>
                  {(active.assets || []).length ? (
                    <div className="space-y-2">
                      {active.assets.map((item) => (
                        <div
                          key={item._id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/70 bg-white/60 p-3 text-sm"
                        >
                          <span>
                            <span className="font-medium text-slate-800">{item.name}</span>{' '}
                            <span className="text-xs text-slate-500">{item.assetTag}</span>
                          </span>
                          {item.returned ? (
                            <span className="chip bg-emerald-50 text-emerald-700">Returned</span>
                          ) : isStaff ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => markAssetReturned(item._id)}
                              disabled={detailBusy}
                            >
                              Mark returned
                            </button>
                          ) : (
                            <span className="chip bg-amber-50 text-amber-700">Pending return</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No company assets assigned.</p>
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3 rounded-xl border border-white/70 bg-white/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exit interview</p>
                    {active.exitInterview?.done ? (
                      <div className="text-sm text-slate-600">
                        <p>
                          <span className="font-medium text-slate-800">Rating:</span> {active.exitInterview.rating || '-'} / 5
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{active.exitInterview.feedback}</p>
                      </div>
                    ) : isStaff ? (
                      <>
                        <Input
                          label="Scheduled at"
                          type="datetime-local"
                          value={interview.scheduledAt}
                          onChange={(event) => setInterview({ ...interview, scheduledAt: event.target.value })}
                        />
                        <Select
                          label="Rating"
                          value={interview.rating}
                          onChange={(event) => setInterview({ ...interview, rating: event.target.value })}
                          options={[1, 2, 3, 4, 5].map((value) => ({ value, label: `${value} / 5` }))}
                        />
                        <Textarea
                          label="Feedback"
                          rows={2}
                          value={interview.feedback}
                          onChange={(event) => setInterview({ ...interview, feedback: event.target.value })}
                        />
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-navy-600"
                            checked={interview.done}
                            onChange={(event) => setInterview({ ...interview, done: event.target.checked })}
                          />
                          Interview completed
                        </label>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={saveInterview} disabled={detailBusy}>
                          Save interview
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">HR will schedule your exit interview.</p>
                    )}
                  </div>

                  <div className="space-y-3 rounded-xl border border-white/70 bg-white/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full & final settlement</p>
                    {active.settlement?.computedAt ? (
                      <div className="space-y-1 text-sm text-slate-600">
                        <p className="flex justify-between"><span>Leave encashment ({active.settlement.leaveEncashmentDays} d)</span><span>{formatCurrency(active.settlement.leaveEncashmentAmount)}</span></p>
                        <p className="flex justify-between"><span>Pending salary</span><span>{formatCurrency(active.settlement.pendingSalary)}</span></p>
                        <p className="flex justify-between"><span>Bonus</span><span>{formatCurrency(active.settlement.bonus)}</span></p>
                        <p className="flex justify-between"><span>Notice recovery</span><span>-{formatCurrency(active.settlement.noticeRecovery)}</span></p>
                        <p className="flex justify-between"><span>Other deductions</span><span>-{formatCurrency(active.settlement.otherDeductions)}</span></p>
                        <p className="flex justify-between border-t border-white/70 pt-1 font-semibold text-slate-900">
                          <span>Net settlement</span>
                          <span>{formatCurrency(active.settlement.netSettlement)}</span>
                        </p>
                        <StatusBadge status={active.settlement.status} />
                        {active.settlement.notes ? <p className="text-xs text-slate-500">{active.settlement.notes}</p> : null}
                        {['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(role) && active.settlement.status === 'PENDING' ? (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => approveSettlement('APPROVED')} disabled={detailBusy}>
                            <BadgeCheck size={14} /> Approve settlement
                          </button>
                        ) : null}
                        {['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(role) && active.settlement.status === 'APPROVED' ? (
                          <button type="button" className="btn btn-success btn-sm" onClick={() => approveSettlement('SETTLED')} disabled={detailBusy}>
                            Mark as paid
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Settlement has not been computed yet.</p>
                    )}
                    {isStaff || isFinance ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            label="Bonus"
                            type="number"
                            min="0"
                            value={settlementForm.bonus}
                            onChange={(event) => setSettlementForm({ ...settlementForm, bonus: event.target.value })}
                          />
                          <Input
                            label="Other deductions"
                            type="number"
                            min="0"
                            value={settlementForm.otherDeductions}
                            onChange={(event) => setSettlementForm({ ...settlementForm, otherDeductions: event.target.value })}
                          />
                        </div>
                        <Input
                          label="Notes"
                          value={settlementForm.notes}
                          onChange={(event) => setSettlementForm({ ...settlementForm, notes: event.target.value })}
                        />
                        <button type="button" className="btn btn-secondary btn-sm" onClick={computeSettlement} disabled={detailBusy}>
                          {active.settlement?.computedAt ? 'Recalculate settlement' : 'Compute settlement'}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-white/70 pt-4">
                  <button type="button" className="btn btn-secondary" onClick={() => downloadLetter('RELIEVING')}>
                    <Download size={14} /> Relieving letter
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => downloadLetter('EXPERIENCE')}>
                    <FileText size={14} /> Experience letter
                  </button>
                  {isStaff && ['APPROVED', 'IN_PROGRESS'].includes(active.status) ? (
                    <button type="button" className="btn btn-primary" onClick={completeExit} disabled={detailBusy}>
                      <CheckCircle2 size={15} /> Complete exit
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}

            {active.status === 'REJECTED' ? (
              <Alert tone="error" title="Resignation rejected">
                The employee remains active. A new resignation can be submitted if required.
              </Alert>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Audit trail</p>
              <div className="space-y-2">
                {(active.history || [])
                  .slice()
                  .reverse()
                  .map((item, index) => (
                    <div key={`${item.action}-${index}`} className="flex items-start gap-2 text-xs text-slate-500">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-400" />
                      <div>
                        <p className="font-medium text-slate-700">{item.action.replace(/_/g, ' ')}</p>
                        <p>{formatDateTime(item.at)}{item.comment ? ` · ${item.comment}` : ''}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default ExitPage;
