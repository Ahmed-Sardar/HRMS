import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { CheckCircle2, Clock, Download, FileText, Search, ShieldCheck, UserCheck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { hrService } from '../../services/performance.service';
import { getErrorMessage } from '../../services/api';
import { REPORT_STATUS_LABELS } from '../../utils/constants';
import { formatDate, formatDateTime } from '../../utils/format';

const HrReviewsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [tab, setTab] = useState('FORWARDED_TO_HR');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pagination: null, counts: {} });
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await hrService.reports({
        status: tab === 'ALL' ? undefined : tab,
        search: search || undefined,
        page,
        limit: 20,
      });
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
    hrService.dashboard().then(setDashboard).catch(() => {});
  }, []);

  const exportReport = async (report, format) => {
    try {
      await hrService.export(report._id, format);
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
      key: 'finance',
      header: 'Finance',
      render: (row) => <span className="text-xs text-slate-500">{row.financeReviewedBy?.name || '—'}</span>,
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
        title="HR performance review"
        description="Reports forwarded by Finance. Add HR feedback, approve, reject or forward to the reporting manager."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'HR reviews' }]}
        actions={
          <span className="chip bg-navy-50 text-navy-800">
            <ShieldCheck size={13} /> {dashboard?.cards?.reportsAwaitingReview ?? 0} awaiting review
          </span>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting HR review" value={dashboard?.cards?.reportsAwaitingReview ?? 0} hint="Forwarded by finance" icon={Clock} tone="amber" />
        <StatCard label="Approved" value={dashboard?.cards?.approvedReports ?? 0} hint="HR approved / completed" icon={CheckCircle2} tone="emerald" />
        <StatCard label="Pending leave" value={dashboard?.cards?.pendingLeaves ?? 0} hint="Requests to approve" icon={UserCheck} tone="indigo" to="/leave/approvals" />
        <StatCard label="New joiners" value={dashboard?.cards?.newJoiners ?? 0} hint="This month" icon={UserCheck} tone="blue" to="/employees" />
      </div>

      <Card>
        <div className="px-4 pt-2">
          <Tabs
            items={[
              { key: 'FORWARDED_TO_HR', label: 'Forwarded' },
              { key: 'UNDER_HR_REVIEW', label: 'In review' },
              { key: 'HR_APPROVED', label: 'Approved' },
              { key: 'HR_REJECTED', label: 'Rejected' },
              { key: 'COMPLETED', label: 'Completed' },
              { key: 'ALL', label: 'All' },
            ]}
            value={tab}
            onChange={(next) => {
              setPage(1);
              setTab(next);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <p className="text-sm text-slate-600">{data.pagination?.total ?? 0} report(s)</p>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field w-64 pl-9"
              placeholder="Search employee"
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
          emptyTitle="No reports in this queue"
          emptyDescription="Reports appear here once Finance approves and forwards them."
        />
      </Card>

      <Card className="mt-4">
        <CardHeader title="HR review guidance" description="What HR validates before final approval" />
        <ol className="grid gap-3 p-5 text-sm text-slate-600 sm:grid-cols-2">
          <li>1. Confirm the performance narrative matches the evidence provided.</li>
          <li>2. Review finance verification comments and attendance context.</li>
          <li>3. Add HR feedback and, where needed, the reporting manager&apos;s assessment.</li>
          <li>4. Approve and mark the report completed to close the workflow.</li>
        </ol>
      </Card>
    </div>
  );
};

export default HrReviewsPage;
