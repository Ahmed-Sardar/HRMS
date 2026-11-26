import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Users, Filter, Download, LayoutGrid, List, Mail, Building2, ArrowUpRight } from 'lucide-react';
import { Stagger, StaggerItem } from '../../components/ui/motion';
import PageHeader from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import { Input, Select } from '../../components/ui/Field';
import { employeeService, departmentService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import { EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS } from '../../utils/constants';
import { formatDate, formatEnum } from '../../utils/format';
import useAuth from '../../hooks/useAuth';
import { ROLES } from '../../utils/constants';

const EmployeesPage = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [filters, setFilters] = useState({ search: '', department: '', status: '', employmentType: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [view, setView] = useState('grid');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await employeeService.list({ ...filters, page, limit: 20 });
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    departmentService
      .list({ limit: 100 })
      .then((res) => setDepartments(res.items || []))
      .catch(() => setDepartments([]));
  }, []);

  const columns = [
    {
      key: 'name',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${row.firstName} ${row.lastName}`} src={row.profilePhoto} />
          <div>
            <p className="font-medium text-slate-900">
              {row.firstName} {row.lastName}
            </p>
            <p className="text-xs text-slate-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'employeeId', header: 'Employee ID', render: (row) => <span className="font-mono text-xs">{row.employeeId}</span> },
    {
      key: 'department',
      header: 'Department',
      render: (row) => (
        <div>
          <p>{row.department?.name || '—'}</p>
          <p className="text-xs text-slate-500">{row.designation?.title || '—'}</p>
        </div>
      ),
    },
    { key: 'employmentType', header: 'Type', render: (row) => formatEnum(row.employmentType) },
    { key: 'dateOfJoining', header: 'Joined', render: (row) => formatDate(row.dateOfJoining) },
    {
      key: 'reportingManager',
      header: 'Reporting to',
      render: (row) =>
        row.reportingManager ? `${row.reportingManager.firstName} ${row.reportingManager.lastName}` : '—',
    },
    {
      key: 'employmentStatus',
      header: 'Status',
      render: (row) => <StatusBadge status={row.employmentStatus} labels={EMPLOYMENT_STATUS_LABELS} />,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/employees/${row._id}`);
          }}
        >
          View
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Employee directory with department, designation and reporting structure."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Employees' }]}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
              <Download size={15} /> Refresh
            </button>
            {hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR) ? (
              <Link to="/employees/new" className="btn btn-primary">
                <Plus size={16} /> Add employee
              </Link>
            ) : null}
          </>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 p-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field pl-9"
              placeholder="Search by name, employee ID, email or phone"
              value={filters.search}
              onChange={(event) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, search: event.target.value }));
              }}
            />
          </div>
          <Select
            value={filters.department}
            onChange={(event) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, department: event.target.value }));
            }}
            placeholder="All departments"
            options={departments.map((dept) => ({ value: dept._id, label: dept.name }))}
          />
          <Select
            value={filters.status}
            onChange={(event) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, status: event.target.value }));
            }}
            placeholder="All statuses"
            options={Object.entries(EMPLOYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </Card>

      {error ? <p className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Users size={16} className="text-slate-400" />
          <span className="font-medium">{data.pagination?.total ?? 0}</span> employees found
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
            <Filter size={14} /> Filters apply to active records by default
          </span>
          <div className="inline-flex items-center gap-1 rounded-xl border border-white bg-white/75 p-1 shadow-inset backdrop-blur">
            <button
              type="button"
              onClick={() => setView('grid')}
              className={view === 'grid' ? 'btn btn-primary btn-sm px-2 py-1' : 'btn btn-ghost btn-sm px-2 py-1'}
              aria-label="Card view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setView('table')}
              className={view === 'table' ? 'btn btn-primary btn-sm px-2 py-1' : 'btn btn-ghost btn-sm px-2 py-1'}
              aria-label="Table view"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {view === 'grid' ? (
        <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="glass-card h-40 animate-pulse p-5" />
              ))
            : data.items.map((row) => (
                <StaggerItem key={row._id}>
                  <Link
                    to={`/employees/${row._id}`}
                    className="glass-card glass-card-hover group flex h-full flex-col justify-between gap-4 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={`${row.firstName} ${row.lastName}`} src={row.profilePhoto} size="md" />
                        <div className="min-w-0">
                          <p className="truncate font-display text-sm font-semibold text-slate-900">
                            {row.firstName} {row.lastName}
                          </p>
                          <p className="truncate text-xs text-slate-500">{row.designation?.title || 'No designation'}</p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{row.employeeId}</p>
                        </div>
                      </div>
                      <StatusBadge status={row.employmentStatus} labels={EMPLOYMENT_STATUS_LABELS} />
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <p className="flex items-center gap-2 truncate">
                        <Building2 size={13} className="shrink-0 text-slate-400" />
                        {row.department?.name || 'Unassigned'} · {formatEnum(row.employmentType)}
                      </p>
                      <p className="flex items-center gap-2 truncate">
                        <Mail size={13} className="shrink-0 text-slate-400" />
                        {row.email}
                      </p>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/70 pt-3 text-[11px] text-slate-500">
                      <span>Joined {formatDate(row.dateOfJoining)}</span>
                      <span className="flex items-center gap-1 font-semibold text-navy-700 opacity-0 transition group-hover:opacity-100">
                        Open <ArrowUpRight size={12} />
                      </span>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
        </Stagger>
      ) : (
        <Card>
          <DataTable
            columns={columns}
            rows={data.items}
            loading={loading}
            pagination={data.pagination}
            onPageChange={setPage}
            onRowClick={(row) => navigate(`/employees/${row._id}`)}
            emptyTitle="No employees found"
            emptyDescription="Try clearing filters or add a new employee record."
            emptyAction={
              hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR) ? (
                <Link to="/employees/new" className="btn btn-primary btn-sm">
                  <Plus size={14} /> Add employee
                </Link>
              ) : null
            }
          />
        </Card>
      )}

      {view === 'grid' && !loading && data.items.length === 0 ? (
        <Card className="mt-3">
          <div className="px-6 py-12 text-center">
            <p className="font-display text-sm font-semibold text-slate-800">No employees found</p>
            <p className="mt-1 text-sm text-slate-500">Try clearing filters or add a new employee record.</p>
          </div>
        </Card>
      ) : null}

      {view === 'grid' && data.pagination && data.pagination.pages > 1 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm text-slate-600 backdrop-blur">
          <p>
            Page <span className="font-semibold text-slate-800">{data.pagination.page}</span> of{' '}
            <span className="font-semibold text-slate-800">{data.pagination.pages}</span> · {data.pagination.total} employees
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-secondary btn-sm" disabled={!data.pagination.hasPrev} onClick={() => setPage((current) => current - 1)}>
              Previous
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={!data.pagination.hasNext} onClick={() => setPage((current) => current + 1)}>
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default EmployeesPage;
