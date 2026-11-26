import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { CheckCircle2, Receipt, Search, Wallet } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Select, Textarea, Input } from '../../components/ui/Field';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { financeService } from '../../services/performance.service';
import { getErrorMessage } from '../../services/api';
import { REIMBURSEMENT_STATUS_LABELS, formatEnum } from '../../utils/constants';
import { formatCurrency, formatDate, currentMonth } from '../../utils/format';

const ReimbursementsPage = () => {
  const dispatch = useDispatch();
  const [tab, setTab] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ items: [], pagination: null, totals: {} });
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm] = useState({ status: 'APPROVED', reviewComment: '', payrollMonth: currentMonth() });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await financeService.reimbursements({ status: tab === 'ALL' ? undefined : tab, page: 1, limit: 50 });
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
      await financeService.reviewReimbursement(reviewModal._id, {
        status: reviewForm.status,
        reviewComment: reviewForm.reviewComment || undefined,
        payrollMonth: reviewForm.status === 'APPROVED' ? reviewForm.payrollMonth : undefined,
      });
      dispatch(toast(`Reimbursement ${reviewForm.status.toLowerCase()}`));
      setReviewModal(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const filtered = (data.items || []).filter((item) => {
    if (!search) return true;
    const name = item.employee ? `${item.employee.firstName} ${item.employee.lastName} ${item.employee.employeeId}` : '';
    return `${name} ${item.title} ${item.category}`.toLowerCase().includes(search.toLowerCase());
  });

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
    {
      key: 'title',
      header: 'Expense',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.title}</p>
          <p className="text-xs text-slate-500">{formatEnum(row.category)} · {formatDate(row.expenseDate)}</p>
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', render: (row) => <span className="font-medium">{formatCurrency(row.amount)}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} labels={REIMBURSEMENT_STATUS_LABELS} /> },
    {
      key: 'review',
      header: 'Review',
      render: (row) => (
        <div className="text-xs text-slate-500">
          <p>{row.reviewedBy?.name || '—'}</p>
          {row.reviewComment ? <p className="italic">“{row.reviewComment}”</p> : null}
          {row.payrollMonth ? <p>Payroll {row.payrollMonth}</p> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          {['PENDING', 'APPROVED'].includes(row.status) ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setReviewModal(row);
                setReviewForm({
                  status: row.status === 'PENDING' ? 'APPROVED' : 'PAID',
                  reviewComment: '',
                  payrollMonth: currentMonth(),
                });
              }}
            >
              <CheckCircle2 size={13} /> Review
            </button>
          ) : null}
          {row.receipt?.originalName ? <span className="chip bg-slate-100 text-slate-600"><Receipt size={11} /> Receipt</span> : null}
        </div>
      ),
    },
  ];

  const pendingTotal = data.totals?.PENDING?.amount || 0;

  return (
    <div>
      <PageHeader
        title="Reimbursements"
        description="Review employee expense claims and include approved amounts in the next payroll run."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Reimbursements' }]}
        actions={
          <span className="chip bg-amber-50 text-amber-700">
            <Wallet size={13} /> Pending {formatCurrency(pendingTotal)}
          </span>
        }
      />

      <Card>
        <div className="px-4 pt-2">
          <Tabs
            items={[
              { key: 'PENDING', label: 'Pending', count: data.totals?.PENDING?.count },
              { key: 'APPROVED', label: 'Approved', count: data.totals?.APPROVED?.count },
              { key: 'PAID', label: 'Paid', count: data.totals?.PAID?.count },
              { key: 'REJECTED', label: 'Rejected', count: data.totals?.REJECTED?.count },
              { key: 'ALL', label: 'All' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <p className="text-sm text-slate-600">{filtered.length} claim(s)</p>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="field w-64 pl-9" placeholder="Search employee or expense" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          loading={loading}
          emptyTitle="No reimbursement claims"
          emptyDescription="Approved claims are added to payroll automatically when the run is processed."
        />
      </Card>

      <Modal
        open={Boolean(reviewModal)}
        onClose={() => setReviewModal(null)}
        title="Review reimbursement"
        description={reviewModal ? `${reviewModal.title} · ${formatCurrency(reviewModal.amount)}` : ''}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setReviewModal(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={review} disabled={busy}>
              Save decision
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Decision"
            value={reviewForm.status}
            onChange={(event) => setReviewForm({ ...reviewForm, status: event.target.value })}
            options={[
              { value: 'APPROVED', label: 'Approve for payroll' },
              { value: 'REJECTED', label: 'Reject claim' },
              { value: 'PAID', label: 'Mark as paid' },
            ]}
          />
          {reviewForm.status === 'APPROVED' ? (
            <Input
              label="Include in payroll month"
              type="month"
              value={reviewForm.payrollMonth}
              onChange={(event) => setReviewForm({ ...reviewForm, payrollMonth: event.target.value })}
            />
          ) : null}
          <Textarea
            label="Review comment"
            rows={3}
            value={reviewForm.reviewComment}
            onChange={(event) => setReviewForm({ ...reviewForm, reviewComment: event.target.value })}
          />
          {reviewModal?.description ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              {reviewModal.description}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

export default ReimbursementsPage;
