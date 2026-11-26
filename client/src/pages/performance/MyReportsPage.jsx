import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Download, FileText, Plus, Trash2, Pencil } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import DataTable from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/Modal';
import { toast } from '../../store/uiSlice';
import { performanceService } from '../../services/performance.service';
import { getErrorMessage } from '../../services/api';
import { REPORT_STATUS_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/format';

const MyReportsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [tab, setTab] = useState('ALL');
  const [data, setData] = useState({ items: [], pagination: null, counts: {} });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await performanceService.myReports({
        status: tab === 'ALL' ? undefined : tab,
        page,
        limit: 20,
      });
      setData(result);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, page, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const exportReport = async (report, format) => {
    try {
      await performanceService.export(report._id, format);
      dispatch(toast(`Report exported as ${format.toUpperCase()}`));
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await performanceService.remove(confirm._id);
      dispatch(toast('Draft deleted'));
      setConfirm(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Report',
      render: (row) => (
        <div>
          <Link to={`/performance/reports/${row._id}`} className="font-medium text-slate-900 hover:text-navy-800">
            {row.title}
          </Link>
          <p className="text-xs text-slate-500">
            {row.periodType} · {formatDate(row.periodStart)} - {formatDate(row.periodEnd)}
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} labels={REPORT_STATUS_LABELS} /> },
    {
      key: 'rating',
      header: 'Rating',
      render: (row) => (row.overallRating ? `${row.overallRating} / 5` : '—'),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      render: (row) => (row.submittedAt ? formatDate(row.submittedAt) : 'Not submitted'),
    },
    {
      key: 'actions',
      header: 'Export',
      render: (row) => (
        <div className="flex items-center gap-1">
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
    {
      key: 'edit',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          {['DRAFT', 'CORRECTION_REQUESTED'].includes(row.status) ? (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/performance/reports/${row._id}/edit`)}>
                <Pencil size={13} /> Edit
              </button>
              {row.status === 'DRAFT' ? (
                <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setConfirm(row)}>
                  <Trash2 size={13} />
                </button>
              ) : null}
            </>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/performance/reports/${row._id}`)}>
              View
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Performance reports"
        description="Create periodic performance reports, generate Excel/CSV/PDF files and track finance and HR approvals."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Performance reports' }]}
        actions={
          <Link to="/performance/reports/new" className="btn btn-primary">
            <Plus size={16} /> New report
          </Link>
        }
      />

      <Card>
        <div className="px-4 pt-2">
          <Tabs
            items={[
              { key: 'ALL', label: 'All reports' },
              { key: 'DRAFT', label: 'Drafts', count: data.counts?.DRAFT },
              { key: 'SUBMITTED', label: 'Submitted', count: data.counts?.SUBMITTED },
              { key: 'CORRECTION_REQUESTED', label: 'Corrections', count: data.counts?.CORRECTION_REQUESTED },
              { key: 'COMPLETED', label: 'Completed', count: data.counts?.COMPLETED },
            ]}
            value={tab}
            onChange={(next) => {
              setPage(1);
              setTab(next);
            }}
          />
        </div>
        <DataTable
          columns={columns}
          rows={data.items}
          loading={loading}
          pagination={data.pagination}
          onPageChange={setPage}
          emptyTitle="No performance reports"
          emptyDescription="Create a report to capture goals, KPIs and achievements for the period."
          emptyAction={
            <Link to="/performance/reports/new" className="btn btn-primary btn-sm">
              <Plus size={14} /> Create report
            </Link>
          }
        />
      </Card>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        title="Delete draft"
        message={`Delete the draft "${confirm?.title}"? This cannot be undone.`}
        confirmLabel="Delete draft"
        variant="danger"
        loading={busy}
      />
    </div>
  );
};

export default MyReportsPage;
