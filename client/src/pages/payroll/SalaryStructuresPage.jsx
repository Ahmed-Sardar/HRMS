import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Select, FormGrid } from '../../components/ui/Field';
import Avatar from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { payrollService } from '../../services/payroll.service';
import { employeeService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import useAuth from '../../hooks/useAuth';
import { ROLES } from '../../utils/constants';

const defaultValues = {
  employee: '',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  basic: 0,
  hra: 0,
  notes: '',
  allowances: [{ name: 'Conveyance Allowance', amount: 1600, type: 'FIXED' }],
  deductions: [{ name: 'Provident Fund', amount: 0, type: 'FIXED' }],
};

const SalaryStructuresPage = () => {
  const dispatch = useDispatch();
  const { hasRole } = useAuth();
  const canManage = hasRole(ROLES.SUPER_ADMIN, ROLES.FINANCE);
  const [structures, setStructures] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const { register, control, handleSubmit, reset, setValue } = useForm({ defaultValues });
  const allowances = useFieldArray({ control, name: 'allowances' });
  const deductions = useFieldArray({ control, name: 'deductions' });
  const watched = useWatch({ control });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await payrollService.structures({ limit: 100 });
      setStructures(result.items || []);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    load();
    employeeService.options().then(setEmployees).catch(() => {});
  }, [load]);

  const gross =
    (Number(watched?.basic) || 0) +
    (Number(watched?.hra) || 0) +
    (watched?.allowances || []).reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
  const totalDeductions = (watched?.deductions || []).reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);

  const open = (structure) => {
    setEditing(structure || null);
    reset(
      structure
        ? {
            employee: structure.employee?._id || '',
            effectiveFrom: new Date(structure.effectiveFrom).toISOString().slice(0, 10),
            basic: structure.basic,
            hra: structure.hra || 0,
            notes: structure.notes || '',
            allowances: structure.allowances?.length ? structure.allowances : [],
            deductions: structure.deductions?.length ? structure.deductions : [],
          }
        : defaultValues,
    );
    setModal(true);
  };

  const save = async (values) => {
    setBusy(true);
    try {
      const payload = {
        ...values,
        basic: Number(values.basic) || 0,
        hra: Number(values.hra) || 0,
        allowances: values.allowances
          .filter((item) => item.name?.trim())
          .map((item) => ({ ...item, amount: Number(item.amount) || 0 })),
        deductions: values.deductions
          .filter((item) => item.name?.trim())
          .map((item) => ({ ...item, amount: Number(item.amount) || 0 })),
      };
      if (editing) {
        delete payload.employee;
        await payrollService.updateStructure(editing._id, payload);
        dispatch(toast('Salary structure updated'));
      } else {
        await payrollService.createStructure(payload);
        dispatch(toast('Salary structure created'));
      }
      setModal(false);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await payrollService.deleteStructure(confirm._id);
      dispatch(toast('Salary structure deactivated'));
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
              {row.employee?.employeeId} · {row.employee?.designation?.title || '—'}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'effectiveFrom', header: 'Effective from', render: (row) => formatDate(row.effectiveFrom) },
    { key: 'basic', header: 'Basic', render: (row) => formatCurrency(row.basic) },
    { key: 'hra', header: 'HRA', render: (row) => formatCurrency(row.hra) },
    {
      key: 'allowances',
      header: 'Allowances',
      render: (row) => formatCurrency((row.allowances || []).reduce((sum, item) => sum + item.amount, 0)),
    },
    {
      key: 'deductions',
      header: 'Deductions',
      render: (row) => formatCurrency((row.deductions || []).reduce((sum, item) => sum + item.amount, 0)),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => <Badge tone={row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        canManage ? (
          <div className="flex gap-1">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(row)}>
              <Pencil size={14} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setConfirm(row)}>
              <Trash2 size={14} />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Salary structures"
        description="Define basic pay, allowances and deductions. Payroll always uses the active structure for the period."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Salary structures' }]}
        actions={
          canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => open(null)}>
              <Plus size={16} /> New structure
            </button>
          ) : null
        }
      />

      <Card>
        <CardHeader title="Structures" description={`${structures.length} configured structures`} />
        <DataTable
          columns={columns}
          rows={structures}
          loading={loading}
          emptyTitle="No salary structures"
          emptyDescription="Add a structure so payroll can be processed for the employee."
        />
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit salary structure' : 'New salary structure'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSubmit(save)} disabled={busy}>
              Save structure
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormGrid columns={3}>
            <Select
              label="Employee"
              required
              disabled={Boolean(editing)}
              placeholder="Select employee"
              options={employees.map((item) => ({ value: item.value, label: item.label }))}
              {...register('employee', { required: true })}
            />
            <Input label="Effective from" type="date" required {...register('effectiveFrom', { required: true })} />
            <Input label="Basic salary" type="number" min="0" required {...register('basic', { required: true })} />
            <Input label="House rent allowance" type="number" min="0" {...register('hra')} />
            <Input label="Notes" {...register('notes')} />
          </FormGrid>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Allowances</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => allowances.append({ name: '', amount: 0, type: 'FIXED' })}>
                <Plus size={13} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {allowances.fields.map((field, index) => (
                <div key={field.id} className="grid gap-2 sm:grid-cols-4">
                  <Input placeholder="Allowance name" {...register(`allowances.${index}.name`)} />
                  <Input placeholder="Amount" type="number" min="0" step="0.01" {...register(`allowances.${index}.amount`)} />
                  <Select
                    options={[
                      { value: 'FIXED', label: 'Fixed amount' },
                      { value: 'PERCENTAGE', label: '% of basic' },
                    ]}
                    {...register(`allowances.${index}.type`)}
                  />
                  <button type="button" className="btn btn-ghost btn-sm justify-self-start text-red-600" onClick={() => allowances.remove(index)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deductions</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => deductions.append({ name: '', amount: 0, type: 'FIXED' })}>
                <Plus size={13} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {deductions.fields.map((field, index) => (
                <div key={field.id} className="grid gap-2 sm:grid-cols-3">
                  <Input placeholder="Deduction name" {...register(`deductions.${index}.name`)} />
                  <Input placeholder="Amount" type="number" min="0" step="0.01" {...register(`deductions.${index}.amount`)} />
                  <button type="button" className="btn btn-ghost btn-sm justify-self-start text-red-600" onClick={() => deductions.remove(index)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Monthly gross</p>
              <p className="font-semibold text-slate-900">{formatCurrency(gross)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Fixed deductions</p>
              <p className="font-semibold text-slate-900">{formatCurrency(totalDeductions)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Approx. net</p>
              <p className="font-semibold text-slate-900">{formatCurrency(gross - totalDeductions)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Creating a new structure automatically closes the previous active structure. Loss of pay and overtime are
            applied during the payroll run using attendance data.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        title="Deactivate salary structure"
        message="The structure will stop being used for future payroll runs. Historical payroll records remain unchanged."
        confirmLabel="Deactivate"
        variant="danger"
        loading={busy}
      />

      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
        <Wallet size={12} /> Payroll calculations are policy-driven and executed on the server.
      </p>
    </div>
  );
};

export default SalaryStructuresPage;
