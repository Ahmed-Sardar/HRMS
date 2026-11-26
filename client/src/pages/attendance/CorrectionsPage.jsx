import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { CheckCircle2, XCircle, ClipboardCheck, Search } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Select, Textarea, Input } from '../../components/ui/Field';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { attendanceService } from '../../services/attendance.service';
import { getErrorMessage } from '../../services/api';
import useAuth from '../../hooks/useAuth';
import { ROLES } from '../../utils/constants';
import { formatDate, formatDateTime, formatTime } from '../../utils/format';

const buildDateTime = (date, time) => {
  if (!date || !time) return undefined;
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
};

const CorrectionsPage = () => {
  const dispatch = useDispatch();
  const { hasRole } = useAuth();
  const isApprover = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR);
  const [tab, setTab] = useState(isApprover ? 'PENDING' : 'ALL');
  const [filters, setFilters] = useState({ search: '' });
  const [data, setData] = useState({ items: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm] = useState({ status: 'APPROVED', reviewComment: '' });
  const [requestModal, setRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({ date: '', checkIn: '', checkOut: '', reason: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await attendanceService.corrections({
        status: tab === 'ALL' ? undefined : tab,
        page: 1,
        limit: 50,
      });
      setData(result);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async () => {
    setBusy(true);
    try {
      await attendanceService.reviewCorrection(reviewModal._id, reviewForm);
      dispatch(toast(`Correction ${reviewForm.status.toLowerCase()}`));
      setReviewModal(null);
      setReviewForm({ status: 'APPROVED', reviewComment: '' });
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await attendanceService.requestCorrection({
        date: requestForm.date,
        requestedCheckIn: buildDateTime(requestForm.date, requestForm.checkIn),
        requestedCheckOut: buildDateTime(requestForm.date, requestForm.checkOut),
        reason: requestForm.reason,
      });
      dispatch(toast('Correction request submitted'));
      setRequestModal(false);
      setRequestForm({ date: '', checkIn: '', checkOut: '', reason: '' });
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const filtered = (data.items || []).filter((item) => {
    if (!filters.search) return true;
    const employeeName = item.employee ? `${item.employee.firstName} ${item.employee.lastName} ${item.employee.employeeId}` : '';
    return `${employeeName} ${item.date} ${item.reason}`.toLowerCase().includes(filters.search.toLowerCase());
  });

  const columns = [
    ...(isApprover
      ? [
          {
            key: 'employee',
            header: 'Employee',
            render: (row) => (
              <div className="flex items-center gap-3">
                <Avatar name={`${row.employee?.firstName || ''} ${row.employee?.lastName || ''}`} />
                <div>
                  <p className="font-medium text-slate-900">
                    {row.employee?.firstName} {row.employee?.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{row.employee?.employeeId}</p>
                </div>
              </div>
            ),
          },
        ]
      : []),
    { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
    {
      key: 'requested',
      header: 'Requested times',
      render: (row) => (
        <div className="text-sm">
          <p>In: {row.requestedCheckIn ? formatTime(row.requestedCheckIn) : '—'}</p>
          <p className="text-xs text-slate-500">Out: {row.requestedCheckOut ? formatTime(row.requestedCheckOut) : '—'}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => <span className="line-clamp-2 max-w-xs text-sm text-slate-600">{row.reason}</span>,
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'review',
      header: 'Review',
      render: (row) =>
        row.reviewedBy ? (
          <div className="text-xs text-slate-500">
            <p>{row.reviewedBy.name}</p>
            <p>{formatDateTime(row.reviewedAt)}</p>
            {row.reviewComment ? <p className="italic">“{row.reviewComment}”</p> : null}
          </div>
        ) : (
          <span className="text-xs text-slate-400">Pending</span>
        ),
    },
    ...(isApprover
      ? [
          {
            key: 'actions',
            header: '',
            render: (row) =>
              row.status === 'PENDING' ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setReviewModal(row);
                      setReviewForm({ status: 'APPROVED', reviewComment: '' });
                    }}
                  >
                    <CheckCircle2 size={13} /> Review
                  </button>
                </div>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Attendance corrections"
        description={
          isApprover
            ? 'Review correction requests. Approved changes are recalculated and written to the audit log.'
            : 'Track your correction requests and their approval status.'
        }
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Corrections' }]}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setRequestModal(true)}>
            <ClipboardCheck size={15} /> Request correction
          </button>
        }
      />

      <Card>
        <div className="px-4 pt-2">
          <Tabs
            items={[
              ...(isApprover ? [{ key: 'PENDING', label: 'Pending' }] : []),
              { key: 'APPROVED', label: 'Approved' },
              { key: 'REJECTED', label: 'Rejected' },
              { key: 'ALL', label: 'All requests' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <p className="text-sm text-slate-600">{filtered.length} request(s)</p>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field w-64 pl-9"
              placeholder="Search employee or date"
              value={filters.search}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          loading={loading}
          emptyTitle="No correction requests"
          emptyDescription={isApprover ? 'There are no requests in this queue.' : 'You have no correction requests yet.'}
        />
      </Card>

      <Modal
        open={Boolean(reviewModal)}
        onClose={() => setReviewModal(null)}
        title="Review correction request"
        description={reviewModal ? `${formatDate(reviewModal.date)} · ${reviewModal.reason}` : ''}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setReviewModal(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={review} disabled={busy}>
              Submit decision
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-slate-600">
              Requested check in: <span className="font-medium">{reviewModal?.requestedCheckIn ? formatTime(reviewModal.requestedCheckIn) : '—'}</span>
            </p>
            <p className="mt-1 text-slate-600">
              Requested check out: <span className="font-medium">{reviewModal?.requestedCheckOut ? formatTime(reviewModal.requestedCheckOut) : '—'}</span>
            </p>
          </div>
          <Select
            label="Decision"
            value={reviewForm.status}
            onChange={(event) => setReviewForm({ ...reviewForm, status: event.target.value })}
            options={[
              { value: 'APPROVED', label: 'Approve correction' },
              { value: 'REJECTED', label: 'Reject request' },
            ]}
          />
          <Textarea
            label="Comment"
            rows={3}
            value={reviewForm.reviewComment}
            onChange={(event) => setReviewForm({ ...reviewForm, reviewComment: event.target.value })}
          />
        </div>
      </Modal>

      <Modal
        open={requestModal}
        onClose={() => setRequestModal(false)}
        title="Request attendance correction"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRequestModal(false)}>
              Cancel
            </button>
            <button type="submit" form="correction-request-form" className="btn btn-primary" disabled={busy}>
              Submit request
            </button>
          </>
        }
      >
        <form id="correction-request-form" onSubmit={submitRequest} className="space-y-4">
          <Input
            label="Attendance date"
            type="date"
            required
            value={requestForm.date}
            onChange={(event) => setRequestForm({ ...requestForm, date: event.target.value })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Correct check in"
              type="time"
              value={requestForm.checkIn}
              onChange={(event) => setRequestForm({ ...requestForm, checkIn: event.target.value })}
            />
            <Input
              label="Correct check out"
              type="time"
              value={requestForm.checkOut}
              onChange={(event) => setRequestForm({ ...requestForm, checkOut: event.target.value })}
            />
          </div>
          <Textarea
            label="Reason"
            required
            rows={3}
            value={requestForm.reason}
            onChange={(event) => setRequestForm({ ...requestForm, reason: event.target.value })}
          />
        </form>
      </Modal>
    </div>
  );
};

export default CorrectionsPage;
