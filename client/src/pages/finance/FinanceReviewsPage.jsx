import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { BadgeIndianRupee, CheckCircle2, Clock, Download, FileText, Search, Send, XCircle } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { financeService } from '../../services/performance.service';
import { getErrorMessage } from '../../services/api';
import { REPORT_STATUS_LABELS, formatEnum } from '../../utils/constants';
import { formatDate, formatDateTime } from '../../utils/format';

const tabs = [
  { key: 'SUBMITTED', label: 'Awaiting verification' },
  { key: 'UNDER_FINANCE_REVIEW', label: 'In review' },
  { key: 'FINANCE_APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'FORWARDED_TO_HR', label: 'Forwarded to HR' },
  { key: 'ALL', label: 'All reports' },
];

const FinanceReviewsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [tab, setTab] = useState('SUBMITTED');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pagination: null, counts: {} });
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status =
        tab === 'ALL'
          ? undefined
          : tab === 'REJECTED'
            ? 'FINANCE_REJECTED'
            : tab === 'CORRECTION_REQUESTED'
              ? 'CORRECTION_REQUESTED'
              : tab;
      const result = await financeService.reports({ status, search: search || undefined, page, limit: 20 });
      setData(result);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, page, search, tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    financeService.dashboard().then(setDashboard).catch(() => {});
  }, []);

  const exportReport = async (report, format) => {
    try {
      await financeService.export(report._id, format);
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
    {
      key: 'title',
      header: 'Report',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.title}</p>
          <p className="text-xs text-slate-500">
            {row.periodType} · {formatDate(row.periodStart)} - {formatDate(row.periodEnd)}
          </p>
        </div>
      ),
    },
    { key: 'submittedAt', header: 'Submitted', render: (row) => (row.submittedAt ? formatDateTime(row.submittedAt) : '—') },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} labels={REPORT_STATUS_LABELS} /> },
    {
      key: 'reviewer',
      header: 'Reviewed by',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.financeReviewedBy?.name || '—'}
          {row.hrReviewedBy ? ` / ${row.hrReviewedBy.name}` : ''}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/performance/reports/${row._id}`)}>
            Review
          </button>
          <button type="button" className="btn btn-ghost btn-sm" title="Excel" onClick={() => exportReport(row, 'xlsx')}>
            <FileText size={14} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" title="CSV" onClick={() => exportReport(row, 'csv')}>
            <Download size={14} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" title="PDF" onClick={() => exportReport(row, 'pdf')}>
            PDF
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Finance verification queue"
        description="Verify employee, attendance, leave and performance data, then approve, reject or forward to HR."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Finance reviews' }]}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting verification" value={dashboard?.cards?.awaitingVerification ?? 0} hint="Submitted reports" icon={Clock} tone="amber" />
        <StatCard label="Approved" value={dashboard?.cards?.approvedReports ?? 0} hint="Ready to forward" icon={CheckCircle2} tone="emerald" />
        <StatCard label="Rejected" value={dashboard?.cards?.rejectedReports ?? 0} hint="Returned to employee" icon={XCircle} tone="red" />
        <StatCard label="Forwarded to HR" value={dashboard?.cards?.forwardedToHr ?? 0} hint="In HR review" icon={Send} tone="blue" />
      </div>

      <Card>
        <div className="px-4 pt-2">
          <Tabs
            items={tabs.map((item) => ({
              ...item,
              count:
                item.key === 'SUBMITTED'
                  ? dashboard?.cards?.awaitingVerification
                  : item.key === 'FINANCE_APPROVED'
                    ? dashboard?.cards?.approvedReports
                    : undefined,
            }))}
            value={tab}
            onChange={(next) => {
              setPage(1);
              setTab(next);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <BadgeIndianRupee size={15} className="text-slate-400" />
            {data.pagination?.total ?? 0} report(s)
          </p>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field w-64 pl-9"
              placeholder="Search employee name or ID"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={data.items}
          loading={loading}
          pagination={data.pagination}
          onPageChange={setPage}
          emptyTitle="Queue is clear"
          emptyDescription="No reports match this status right now."
        />
      </Card>

      <Card className="mt-4">
        <CardHeader title="Verification checklist" description="Applied to every report before finance approval" />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            'Confirm employee identity and reporting line',
            'Cross-check attendance summary for the period',
            'Validate approved leave against the leave register',
            'Review attachments and performance evidence',
          ].map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
              {item}
            </div>
          ))}
        </div>
      </Card>

      <p className="mt-3 text-xs text-slate-400">
        Status reference: {Object.keys(REPORT_STATUS_LABELS).map((key) => formatEnum(key)).slice(0, 4).join(' · ')} ...
      </p>
    </div>
  );
};

export default FinanceReviewsPage;
