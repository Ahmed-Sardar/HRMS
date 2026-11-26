import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { CheckCircle2, Download, FileSpreadsheet, FileText, Search } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Select, Textarea } from '../../components/ui/Field';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { leaveService } from '../../services/leave.service';
import { getErrorMessage } from '../../services/api';
import { LEAVE_STATUS_LABELS } from '../../utils/constants';
import { formatDate, formatDateTime, formatEnum } from '../../utils/format';

const LeaveApprovalsPage = () => {
  const dispatch = useDispatch();
  const [tab, setTab] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ items: [], pagination: null, counts: {} });
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm] = useState({ status: 'APPROVED', reviewComment: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await leaveService.list({
        status: tab === 'ALL' ? undefined : tab,
        search: search || undefined,
        page: 1,
        limit: 50,
      });
      setData(result);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, search, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async () => {
    setBusy(true);
    try {
      await leaveService.review(reviewModal._id, reviewForm);
      dispatch(toast(`Leave ${reviewForm.status.toLowerCase()}`));
      setReviewModal(null);
      setReviewForm({ status: 'APPROVED', reviewComment: '' });
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const exportAs = async (format) => {
    try {
      await leaveService.export({ status: tab === 'ALL' ? undefined : tab, format });
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
          <Avatar name={`${row.employee?.firstName || ''} ${row.employee?.lastName || ''}`} />
          <div>
            <p className="font-medium text-slate-900">
              {row.employee?.firstName} {row.employee?.lastName}
            </p>
            <p className="text-xs text-slate-500">
              {row.employee?.employeeId} · {row.employee?.department?.name || '—'}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'leaveType', header: 'Type', render: (row) => formatEnum(row.leaveType) },
    {
      key: 'period',
      header: 'Period',
      render: (row) => (
        <div>
          <p className="text-sm">{formatDate(row.startDate)} - {formatDate(row.endDate)}</p>
          <p className="text-xs text-slate-500">
            {row.totalDays} day(s){row.isHalfDay ? ' · half day' : ''}
          </p>
        </div>
      ),
    },
    { key: 'reason', header: 'Reason', render: (row) => <span className="line-clamp-2 max-w-xs text-sm">{row.reason}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} labels={LEAVE_STATUS_LABELS} /> },
    {
      key: 'appliedAt',
      header: 'Applied',
      render: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.appliedAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.status === 'PENDING' ? (
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
        ) : (
          <span className="text-xs text-slate-400">{row.reviewedBy?.name || '—'}</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Leave approvals"
        description="Approve or reject leave requests. Approved leave is marked in attendance and deducted from balances."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Leave approvals' }]}
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

      <Card>
        <div className="px-4 pt-2">
          <Tabs
            items={[
              { key: 'PENDING', label: 'Pending', count: data.counts?.PENDING },
              { key: 'APPROVED', label: 'Approved', count: data.counts?.APPROVED },
              { key: 'REJECTED', label: 'Rejected', count: data.counts?.REJECTED },
              { key: 'ALL', label: 'All' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <p className="text-sm text-slate-600">{data.pagination?.total ?? 0} request(s)</p>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field w-64 pl-9"
              placeholder="Search employee or ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={data.items}
          loading={loading}
          emptyTitle="No leave requests"
          emptyDescription="There are no requests in this queue."
        />
      </Card>

      <Modal
        open={Boolean(reviewModal)}
        onClose={() => setReviewModal(null)}
        title="Review leave request"
        description={
          reviewModal
            ? `${reviewModal.employee?.firstName} ${reviewModal.employee?.lastName} · ${formatDate(reviewModal.startDate)} - ${formatDate(reviewModal.endDate)} (${reviewModal.totalDays} days)`
            : ''
        }
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
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <p>
              <span className="font-medium">Reason:</span> {reviewModal?.reason}
            </p>
            {reviewModal?.contactDuringLeave ? (
              <p className="mt-1">
                <span className="font-medium">Contact:</span> {reviewModal.contactDuringLeave}
              </p>
            ) : null}
            <p className="mt-1">
              <span className="font-medium">Applied:</span> {formatDateTime(reviewModal?.appliedAt)}
            </p>
          </div>
          <Select
            label="Decision"
            value={reviewForm.status}
            onChange={(event) => setReviewForm({ ...reviewForm, status: event.target.value })}
            options={[
              { value: 'APPROVED', label: 'Approve leave' },
              { value: 'REJECTED', label: 'Reject request' },
            ]}
          />
          <Textarea
            label="HR comment"
            rows={3}
            value={reviewForm.reviewComment}
            onChange={(event) => setReviewForm({ ...reviewForm, reviewComment: event.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
};

export default LeaveApprovalsPage;
