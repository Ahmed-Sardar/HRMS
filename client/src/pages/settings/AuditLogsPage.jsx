import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { ScrollText, Search } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Field';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { settingsService } from '../../services/settings.service';
import { getErrorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/format';

const MODULES = ['AUTH', 'USER', 'EMPLOYEE', 'DEPARTMENT', 'ATTENDANCE', 'LEAVE', 'PERFORMANCE', 'FINANCE', 'HR', 'PAYROLL', 'DOCUMENT', 'ASSET', 'RECRUITMENT', 'ANNOUNCEMENT', 'SETTINGS'];

const AuditLogsPage = () => {
  const dispatch = useDispatch();
  const [data, setData] = useState({ items: [], pagination: null });
  const [filters, setFilters] = useState({ module: '', search: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await settingsService.auditLogs({
        module: filters.module || undefined,
        search: filters.search || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        page,
        limit: 30,
      });
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

  const columns = [
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.action}</p>
          <p className="text-xs text-slate-500">{row.description}</p>
        </div>
      ),
    },
    { key: 'module', header: 'Module', render: (row) => <Badge>{row.module}</Badge> },
    {
      key: 'actor',
      header: 'Actor',
      render: (row) => (
        <div>
          <p className="text-sm text-slate-800">{row.actorName || 'System'}</p>
          <p className="text-xs text-slate-500">{row.actorRole || '—'}</p>
        </div>
      ),
    },
    { key: 'ip', header: 'IP', render: (row) => <span className="text-xs text-slate-500">{row.ipAddress || '—'}</span> },
    { key: 'createdAt', header: 'When', render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(row)}>
          Details
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit logs"
        description="Immutable trail of privileged actions across every module."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Audit logs' }]}
      />

      <Card>
        <CardHeader title="Activity trail" description={`${data.pagination?.total ?? 0} recorded events`} actions={<ScrollText size={16} className="text-slate-400" />} />
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field pl-9"
              placeholder="Search action, description or actor"
              value={filters.search}
              onChange={(event) => {
                setPage(1);
                setFilters({ ...filters, search: event.target.value });
              }}
            />
          </div>
          <Select
            placeholder="All modules"
            value={filters.module}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, module: event.target.value });
            }}
            options={MODULES.map((value) => ({ value, label: value }))}
          />
          <Input
            type="date"
            value={filters.from}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, from: event.target.value });
            }}
          />
          <Input
            type="date"
            value={filters.to}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, to: event.target.value });
            }}
          />
        </div>
        <DataTable
          columns={columns}
          rows={data.items}
          loading={loading}
          pagination={data.pagination}
          onPageChange={setPage}
          emptyTitle="No audit events"
          emptyDescription="Actions performed by administrators and staff will be recorded here."
        />
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.action || 'Audit event'}
        description={selected ? formatDateTime(selected.createdAt) : ''}
        size="lg"
      >
        {selected ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Module', selected.module],
                ['Actor', `${selected.actorName || 'System'} (${selected.actorRole || '—'})`],
                ['Entity', `${selected.entityType || '—'} ${selected.entityId || ''}`],
                ['IP address', selected.ipAddress || '—'],
                ['User agent', selected.userAgent || '—'],
                ['Request', selected.method ? `${selected.method} ${selected.path || ''}` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-0.5 break-words text-slate-800">{value}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Description</p>
              <p className="mt-1 text-slate-700">{selected.description || '—'}</p>
            </div>
            {selected.previousValue || selected.newValue ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Previous value</p>
                  <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                    {JSON.stringify(selected.previousValue ?? null, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">New value</p>
                  <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                    {JSON.stringify(selected.newValue ?? null, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default AuditLogsPage;
