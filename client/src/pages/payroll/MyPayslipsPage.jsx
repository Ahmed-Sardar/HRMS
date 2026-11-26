import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Download, Plus, Receipt, Trash2, Upload, Wallet } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { payrollService } from '../../services/payroll.service';
import { getErrorMessage } from '../../services/api';
import { PAYROLL_STATUS_LABELS, REIMBURSEMENT_STATUS_LABELS, formatEnum } from '../../utils/constants';
import { formatCurrency, formatDate, monthLabel, currentMonth } from '../../utils/format';

const MyPayslipsPage = () => {
  const dispatch = useDispatch();
  const [payslips, setPayslips] = useState({ items: [], pagination: null });
  const [reimbursements, setReimbursements] = useState({ items: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'TRAVEL', amount: '', expenseDate: '', description: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [payslipData, reimbursementData] = await Promise.all([
        payrollService.myPayslips({ limit: 24 }),
        payrollService.myReimbursements({ limit: 24 }),
      ]);
      setPayslips(payslipData);
      setReimbursements(reimbursementData);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const submitReimbursement = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('category', form.category);
      formData.append('amount', form.amount);
      formData.append('expenseDate', form.expenseDate);
      if (form.description) formData.append('description', form.description);
      if (file) formData.append('receipt', file);
      await payrollService.createReimbursement(formData);
      dispatch(toast('Reimbursement request submitted'));
      setModal(false);
      setForm({ title: '', category: 'TRAVEL', amount: '', expenseDate: '', description: '' });
      setFile(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const cancelReimbursement = async (item) => {
    try {
      await payrollService.cancelReimbursement(item._id);
      dispatch(toast('Reimbursement cancelled'));
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const download = async (row) => {
    try {
      await payrollService.payslip(row._id);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const columns = [
    { key: 'month', header: 'Period', render: (row) => monthLabel(row.month) },
    { key: 'paidDays', header: 'Paid days', render: (row) => `${row.paidDays} / ${row.workingDays}` },
    { key: 'grossEarnings', header: 'Gross', render: (row) => formatCurrency(row.grossEarnings) },
    { key: 'totalDeductions', header: 'Deductions', render: (row) => formatCurrency(row.totalDeductions) },
    { key: 'netPay', header: 'Net pay', render: (row) => <span className="font-semibold text-slate-900">{formatCurrency(row.netPay)}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} labels={PAYROLL_STATUS_LABELS} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => download(row)}>
          <Download size={13} /> Payslip PDF
        </button>
      ),
    },
  ];

  const reimbursementColumns = [
    {
      key: 'title',
      header: 'Claim',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.title}</p>
          <p className="text-xs text-slate-500">
            {formatEnum(row.category)} · {formatDate(row.expenseDate)}
          </p>
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', render: (row) => formatCurrency(row.amount) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} labels={REIMBURSEMENT_STATUS_LABELS} /> },
    {
      key: 'review',
      header: 'Review',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.reviewedBy?.name || 'Awaiting review'}
          {row.reviewComment ? ` · ${row.reviewComment}` : ''}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.status === 'PENDING' ? (
          <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => cancelReimbursement(row)}>
            <Trash2 size={13} />
          </button>
        ) : null,
    },
  ];

  const currentMonthPayroll = (payslips.items || []).find((item) => item.month === currentMonth());

  return (
    <div>
      <PageHeader
        title="My payslips & reimbursements"
        description="Download approved payslips and claim expenses for payroll reimbursement."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'My payslips' }]}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setModal(true)}>
            <Plus size={16} /> New reimbursement
          </button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="stat-label">Latest net pay</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {currentMonthPayroll ? formatCurrency(currentMonthPayroll.netPay) : formatCurrency(payslips.items?.[0]?.netPay || 0)}
          </p>
          <p className="text-xs text-slate-500">{monthLabel(currentMonthPayroll?.month || payslips.items?.[0]?.month)}</p>
        </Card>
        <Card className="p-4">
          <p className="stat-label">Payslips available</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{payslips.pagination?.total ?? 0}</p>
          <p className="text-xs text-slate-500">Approved payroll records</p>
        </Card>
        <Card className="p-4">
          <p className="stat-label">Pending reimbursements</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {(reimbursements.items || []).filter((item) => item.status === 'PENDING').length}
          </p>
          <p className="text-xs text-slate-500">Awaiting finance review</p>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader title="Payslips" description="Server-generated PDF payslips" />
        <DataTable columns={columns} rows={payslips.items} loading={loading} emptyTitle="No payslips available" emptyDescription="Payslips appear after finance approves the payroll run." />
      </Card>

      <Card>
        <CardHeader title="Reimbursements" description="Expense claims and their status" />
        <DataTable
          columns={reimbursementColumns}
          rows={reimbursements.items}
          loading={loading}
          emptyTitle="No reimbursement claims"
          emptyDescription="Submit an expense claim with a receipt for finance review."
          emptyAction={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal(true)}>
              <Receipt size={14} /> New claim
            </button>
          }
        />
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="New reimbursement claim"
        description="Approved claims are included in the payroll month selected by finance."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button type="submit" form="reimbursement-form" className="btn btn-primary" disabled={busy}>
              Submit claim
            </button>
          </>
        }
      >
        <form id="reimbursement-form" onSubmit={submitReimbursement} className="space-y-4">
          <Input label="Claim title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Category"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              options={[
                { value: 'TRAVEL', label: 'Travel' },
                { value: 'MEALS', label: 'Meals' },
                { value: 'MEDICAL', label: 'Medical' },
                { value: 'INTERNET', label: 'Internet' },
                { value: 'EQUIPMENT', label: 'Equipment' },
                { value: 'TRAINING', label: 'Training' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />
            <Input label="Amount" type="number" min="1" step="0.01" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            <Input label="Expense date" type="date" required value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} />
            <div className="flex flex-col">
              <label className="label" htmlFor="receipt">
                Receipt (PDF or image)
              </label>
              <label
                htmlFor="receipt"
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-navy-400"
              >
                <Upload size={15} /> {file ? file.name : 'Choose file'}
              </label>
              <input id="receipt" type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </div>
          </div>
          <Textarea label="Description" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </form>
      </Modal>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
        <Wallet size={12} /> Payslips are immutable snapshots generated at approval time.
      </p>
    </div>
  );
};

export default MyPayslipsPage;
