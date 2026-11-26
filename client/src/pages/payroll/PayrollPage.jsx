import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { BadgeIndianRupee, CheckCircle2, Download, FileSpreadsheet, FileText, Play, Search, Wallet } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Field';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { payrollService } from '../../services/payroll.service';
import { departmentService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import { PAYROLL_STATUS_LABELS } from '../../utils/constants';
import { currentMonth, formatCurrency, formatDate, monthLabel } from '../../utils/format';

const PayrollPage = () => {
  const dispatch = useDispatch();
  const [filters, setFilters] = useState({ month: currentMonth(), status: '', department: '', search: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pagination: null, totals: {} });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runModal, setRunModal] = useState(false);
  const [runForm, setRunForm] = useState({ month: currentMonth(), department: '', notes: '' });
  const [runResult, setRunResult] = useState(null);
  const [confirmApprove, setConfirmApprove] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await payrollService.list({ ...filters, page, limit: 25 });
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

  useEffect(() => {
    departmentService.list({ limit: 100 }).then((res) => setDepartments(res.items || [])).catch(() => {});
  }, []);

  const runPayroll = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await payrollService.run({
        month: runForm.month,
        department: runForm.department || undefined,
        notes: runForm.notes || undefined,
      });
      setRunResult(result);
      dispatch(toast(`Payroll processed for ${result.month}`));
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    setBusy(true);
    try {
      await payrollService.approve(confirmApprove._id);
      dispatch(toast('Payroll approved and payslip generated'));
      setConfirmApprove(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    setBusy(true);
    try {
      await payrollService.markPaid(payModal._id, { paymentReference: paymentReference || undefined });
      dispatch(toast('Payroll marked as paid'));
      setPayModal(null);
      setPaymentReference('');
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const approveMonth = async () => {
    setBusy(true);
    try {
      const result = await payrollService.approveMonth(filters.month);
      dispatch(toast(`${result.approved} payroll record(s) approved`));
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const exportAs = async (format) => {
    try {
      await payrollService.export({ month: filters.month, status: filters.status || undefined, format });
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const downloadPayslip = async (row) => {
    try {
      await payrollService.payslip(row._id);
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
    { key: 'month', header: 'Month', render: (row) => monthLabel(row.month) },
    {
      key: 'days',
      header: 'Days',
      render: (row) => (
        <span className="text-sm">
          {row.paidDays}/{row.workingDays}
          {row.lopDays ? <span className="ml-1 text-xs text-amber-600">LOP {row.lopDays}</span> : null}
        </span>
      ),
    },
    { key: 'grossEarnings', header: 'Gross', render: (row) => formatCurrency(row.grossEarnings) },
    { key: 'totalDeductions', header: 'Deductions', render: (row) => formatCurrency(row.totalDeductions) },
    { key: 'netPay', header: 'Net pay', render: (row) => <span className="font-semibold text-slate-900">{formatCurrency(row.netPay)}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} labels={PAYROLL_STATUS_LABELS} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          {row.status === 'DRAFT' ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setConfirmApprove(row)}>
              <CheckCircle2 size={13} /> Approve
            </button>
          ) : null}
          {row.status === 'APPROVED' ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPayModal(row)}>
              Mark paid
            </button>
          ) : null}
          {['APPROVED', 'PAID'].includes(row.status) ? (
            <button type="button" className="btn btn-ghost btn-sm" title="Payslip PDF" onClick={() => downloadPayslip(row)}>
              <FileText size={14} />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payroll register"
        description="Process monthly payroll from salary structures, attendance and approved reimbursements."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Payroll' }]}
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
            <button type="button" className="btn btn-primary" onClick={() => setRunModal(true)}>
              <Play size={15} /> Run payroll
            </button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Records"
          value={(data.totals?.DRAFT?.count || 0) + (data.totals?.APPROVED?.count || 0) + (data.totals?.PAID?.count || 0)}
          hint={monthLabel(filters.month)}
          icon={Wallet}
          tone="navy"
        />
        <StatCard label="Draft" value={data.totals?.DRAFT?.count || 0} hint={formatCurrency(data.totals?.DRAFT?.net || 0)} icon={BadgeIndianRupee} tone="amber" />
        <StatCard label="Approved" value={data.totals?.APPROVED?.count || 0} hint={formatCurrency(data.totals?.APPROVED?.net || 0)} icon={CheckCircle2} tone="blue" />
        <StatCard label="Paid" value={data.totals?.PAID?.count || 0} hint={formatCurrency(data.totals?.PAID?.net || 0)} icon={CheckCircle2} tone="emerald" />
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 p-4 md:grid-cols-5">
          <input type="month" className="field" value={filters.month} onChange={(event) => { setPage(1); setFilters({ ...filters, month: event.target.value }); }} />
          <Select
            placeholder="All statuses"
            value={filters.status}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, status: event.target.value });
            }}
            options={Object.entries(PAYROLL_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            placeholder="All departments"
            value={filters.department}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, department: event.target.value });
            }}
            options={departments.map((dept) => ({ value: dept._id, label: dept.name }))}
          />
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field pl-9"
              placeholder="Search employee"
              value={filters.search}
              onChange={(event) => {
                setPage(1);
                setFilters({ ...filters, search: event.target.value });
              }}
            />
          </div>
          <button type="button" className="btn btn-secondary" onClick={approveMonth} disabled={busy}>
            Approve month
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Payroll records" description={`${data.pagination?.total ?? 0} record(s) · ${monthLabel(filters.month)}`} />
        <DataTable
          columns={columns}
          rows={data.items}
          loading={loading}
          pagination={data.pagination}
          onPageChange={setPage}
          emptyTitle="No payroll records"
          emptyDescription="Run payroll for the selected month to generate records from active salary structures."
        />
      </Card>

      <Modal
        open={runModal}
        onClose={() => {
          setRunModal(false);
          setRunResult(null);
        }}
        title="Run monthly payroll"
        description="Calculates paid days from attendance, deducts loss of pay and includes approved reimbursements."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setRunModal(false); setRunResult(null); }}>
              Close
            </button>
            <button type="submit" form="payroll-run-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Processing...' : 'Process payroll'}
            </button>
          </>
        }
      >
        <form id="payroll-run-form" onSubmit={runPayroll} className="space-y-4">
          <Input label="Payroll month" type="month" required value={runForm.month} onChange={(event) => setRunForm({ ...runForm, month: event.target.value })} />
          <Select
            label="Department (optional)"
            placeholder="All departments"
            value={runForm.department}
            onChange={(event) => setRunForm({ ...runForm, department: event.target.value })}
            options={departments.map((dept) => ({ value: dept._id, label: dept.name }))}
          />
          <Input label="Notes" value={runForm.notes} onChange={(event) => setRunForm({ ...runForm, notes: event.target.value })} />
          {runResult ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-semibold">Run complete for {runResult.month}</p>
              <p className="mt-1">
                {runResult.created} created · {runResult.updated} updated · {runResult.noStructure} without salary structure ·{' '}
                {runResult.skipped} locked
              </p>
              <p className="mt-1 text-xs">Working days used: {runResult.workingDays}</p>
              {runResult.errors?.length ? (
                <ul className="mt-2 list-disc pl-4 text-xs">
                  {runResult.errors.slice(0, 5).map((item) => (
                    <li key={item.employee}>
                      {item.employee}: {item.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmApprove)}
        onClose={() => setConfirmApprove(null)}
        onConfirm={approve}
        title="Approve payroll"
        message={`Approve payroll for ${confirmApprove?.employee?.firstName || ''} ${confirmApprove?.employee?.lastName || ''} (${monthLabel(confirmApprove?.month)})? A payslip will be generated and the employee notified.`}
        confirmLabel="Approve and generate payslip"
        loading={busy}
      />

      <Modal
        open={Boolean(payModal)}
        onClose={() => setPayModal(null)}
        title="Mark payroll as paid"
        description={payModal ? `${payModal.employee?.firstName} ${payModal.employee?.lastName} · ${formatCurrency(payModal.netPay)}` : ''}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPayModal(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={markPaid} disabled={busy}>
              Confirm payment
            </button>
          </>
        }
      >
        <Input label="Payment reference" placeholder="UTR / transaction reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
        <p className="mt-2 text-xs text-slate-500">Payment date will be recorded as {formatDate(new Date())}.</p>
      </Modal>
    </div>
  );
};

export default PayrollPage;
