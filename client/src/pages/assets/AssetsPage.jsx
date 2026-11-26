import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Laptop, PackageCheck, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Select, Textarea, FormGrid } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { assetService } from '../../services/document.service';
import { employeeService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import useAuth from '../../hooks/useAuth';
import { ASSET_CATEGORIES, ROLES, formatEnum } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/format';

const emptyAsset = {
  assetTag: '',
  name: '',
  category: 'LAPTOP',
  brand: '',
  model: '',
  serialNumber: '',
  purchaseDate: '',
  purchaseCost: '',
  warrantyExpiry: '',
  condition: 'NEW',
  status: 'AVAILABLE',
  notes: '',
};

const AssetsPage = () => {
  const dispatch = useDispatch();
  const { hasRole } = useAuth();
  const isManager = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR);

  const [data, setData] = useState({ items: [], pagination: null, counts: {} });
  const [myAssets, setMyAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', category: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [assetModal, setAssetModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyAsset);
  const [assignModal, setAssignModal] = useState(null);
  const [assignForm, setAssignForm] = useState({ employee: '', expectedReturnDate: '', condition: 'GOOD', notes: '' });
  const [returnModal, setReturnModal] = useState(null);
  const [returnForm, setReturnForm] = useState({ condition: 'GOOD', notes: '', status: 'AVAILABLE' });
  const [confirmRetire, setConfirmRetire] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isManager || hasRole(ROLES.FINANCE)) {
        setData(await assetService.list({ ...filters, page, limit: 25 }));
      } else {
        setMyAssets(await assetService.my());
      }
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, filters, hasRole, isManager, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isManager) employeeService.options().then(setEmployees).catch(() => {});
  }, [isManager]);

  const openAsset = (asset) => {
    setEditing(asset || null);
    setForm(
      asset
        ? {
            assetTag: asset.assetTag,
            name: asset.name,
            category: asset.category,
            brand: asset.brand || '',
            model: asset.model || '',
            serialNumber: asset.serialNumber || '',
            purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().slice(0, 10) : '',
            purchaseCost: asset.purchaseCost || '',
            warrantyExpiry: asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toISOString().slice(0, 10) : '',
            condition: asset.condition || 'NEW',
            status: asset.status || 'AVAILABLE',
            notes: asset.notes || '',
          }
        : emptyAsset,
    );
    setAssetModal(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
        purchaseDate: form.purchaseDate || undefined,
        warrantyExpiry: form.warrantyExpiry || undefined,
        brand: form.brand || undefined,
        model: form.model || undefined,
        serialNumber: form.serialNumber || undefined,
      };
      if (editing) await assetService.update(editing._id, payload);
      else await assetService.create(payload);
      dispatch(toast(editing ? 'Asset updated' : 'Asset added'));
      setAssetModal(false);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const assign = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await assetService.assign(assignModal._id, {
        employee: assignForm.employee,
        expectedReturnDate: assignForm.expectedReturnDate || undefined,
        condition: assignForm.condition,
        notes: assignForm.notes || undefined,
      });
      dispatch(toast('Asset assigned'));
      setAssignModal(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const returnAsset = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await assetService.returnAsset(returnModal._id, {
        condition: returnForm.condition,
        notes: returnForm.notes || undefined,
        status: returnForm.status,
      });
      dispatch(toast('Asset returned'));
      setReturnModal(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const retire = async () => {
    setBusy(true);
    try {
      await assetService.remove(confirmRetire._id);
      dispatch(toast('Asset retired'));
      setConfirmRetire(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'asset',
      header: 'Asset',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.name}</p>
          <p className="text-xs text-slate-500">
            {row.assetTag} · {formatEnum(row.category)}
            {row.serialNumber ? ` · SN ${row.serialNumber}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'assignedTo',
      header: 'Assigned to',
      render: (row) =>
        row.assignedTo ? (
          <div>
            <p className="text-sm text-slate-800">
              {row.assignedTo.firstName} {row.assignedTo.lastName}
            </p>
            <p className="text-xs text-slate-500">{row.assignedTo.employeeId}</p>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Unassigned</span>
        ),
    },
    { key: 'condition', header: 'Condition', render: (row) => formatEnum(row.condition) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'purchaseCost', header: 'Value', render: (row) => (row.purchaseCost ? formatCurrency(row.purchaseCost) : '—') },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {isManager && row.status !== 'ASSIGNED' ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setAssignModal(row);
                setAssignForm({ employee: '', expectedReturnDate: '', condition: row.condition || 'GOOD', notes: '' });
              }}
            >
              Assign
            </button>
          ) : null}
          {isManager && row.status === 'ASSIGNED' ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setReturnModal(row);
                setReturnForm({ condition: row.condition || 'GOOD', notes: '', status: 'AVAILABLE' });
              }}
            >
              <RotateCcw size={13} /> Return
            </button>
          ) : null}
          {isManager ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openAsset(row)}>
                Edit
              </button>
              <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setConfirmRetire(row)}>
                <Trash2 size={13} />
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  const myColumns = [
    {
      key: 'asset',
      header: 'Asset',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.name}</p>
          <p className="text-xs text-slate-500">
            {row.assetTag} · {formatEnum(row.category)} · {row.brand || ''} {row.model || ''}
          </p>
        </div>
      ),
    },
    { key: 'condition', header: 'Condition', render: (row) => formatEnum(row.condition) },
    { key: 'assignedAt', header: 'Assigned on', render: (row) => formatDate(row.assignedAt) },
    { key: 'expectedReturnDate', header: 'Return by', render: (row) => (row.expectedReturnDate ? formatDate(row.expectedReturnDate) : '—') },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  if (!isManager && !hasRole(ROLES.FINANCE)) {
    return (
      <div>
        <PageHeader
          title="My assets"
          description="Company assets currently assigned to you."
          breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Assets' }]}
        />
        <Card>
          <CardHeader title="Assigned assets" description={`${myAssets.length} asset(s)`} />
          <DataTable
            columns={myColumns}
            rows={myAssets}
            loading={loading}
            emptyTitle="No assets assigned"
            emptyDescription="Laptops, access cards and other assets assigned to you will appear here."
          />
        </Card>
        <p className="mt-3 text-xs text-slate-400">Report damaged or lost assets to HR so the register can be updated.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Company assets"
        description="Track hardware, access cards and other assets, including assignment and return history."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Assets' }]}
        actions={
          isManager ? (
            <button type="button" className="btn btn-primary" onClick={() => openAsset(null)}>
              <Plus size={16} /> Add asset
            </button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available" value={data.counts?.AVAILABLE || 0} hint="Ready to assign" icon={PackageCheck} tone="emerald" />
        <StatCard label="Assigned" value={data.counts?.ASSIGNED || 0} hint="With employees" icon={Laptop} tone="blue" />
        <StatCard label="In repair" value={data.counts?.IN_REPAIR || 0} hint="Maintenance" icon={Laptop} tone="amber" />
        <StatCard label="Total assets" value={data.pagination?.total || 0} hint="Active register" icon={Laptop} tone="navy" />
      </div>

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-4">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field pl-9"
              placeholder="Search tag, name or serial"
              value={filters.search}
              onChange={(event) => {
                setPage(1);
                setFilters({ ...filters, search: event.target.value });
              }}
            />
          </div>
          <Select
            placeholder="All statuses"
            value={filters.status}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, status: event.target.value });
            }}
            options={['AVAILABLE', 'ASSIGNED', 'IN_REPAIR', 'RETIRED', 'LOST'].map((value) => ({ value, label: formatEnum(value) }))}
          />
          <Select
            placeholder="All categories"
            value={filters.category}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, category: event.target.value });
            }}
            options={ASSET_CATEGORIES}
          />
          <p className="flex items-center text-sm text-slate-500">{data.pagination?.total ?? 0} asset(s)</p>
        </div>
        <DataTable
          columns={columns}
          rows={data.items || []}
          loading={loading}
          pagination={data.pagination}
          onPageChange={setPage}
          emptyTitle="No assets"
          emptyDescription="Add company assets to track assignment and returns."
        />
      </Card>

      <Modal
        open={assetModal}
        onClose={() => setAssetModal(false)}
        title={editing ? 'Edit asset' : 'Add asset'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAssetModal(false)}>
              Cancel
            </button>
            <button type="submit" form="asset-form" className="btn btn-primary" disabled={busy}>
              Save asset
            </button>
          </>
        }
      >
        <form id="asset-form" onSubmit={save}>
          <FormGrid columns={2}>
            <Input label="Asset tag" required value={form.assetTag} onChange={(event) => setForm({ ...form, assetTag: event.target.value })} />
            <Input label="Asset name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <Select
              label="Category"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              options={ASSET_CATEGORIES}
            />
            <Input label="Brand" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
            <Input label="Model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
            <Input label="Serial number" value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} />
            <Input label="Purchase date" type="date" value={form.purchaseDate} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })} />
            <Input label="Purchase cost" type="number" min="0" value={form.purchaseCost} onChange={(event) => setForm({ ...form, purchaseCost: event.target.value })} />
            <Input label="Warranty expiry" type="date" value={form.warrantyExpiry} onChange={(event) => setForm({ ...form, warrantyExpiry: event.target.value })} />
            <Select
              label="Condition"
              value={form.condition}
              onChange={(event) => setForm({ ...form, condition: event.target.value })}
              options={['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE'].map((value) => ({ value, label: formatEnum(value) }))}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              options={['AVAILABLE', 'IN_REPAIR', 'RETIRED', 'LOST'].map((value) => ({ value, label: formatEnum(value) }))}
            />
          </FormGrid>
          <div className="mt-4">
            <Textarea label="Notes" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(assignModal)}
        onClose={() => setAssignModal(null)}
        title="Assign asset"
        description={assignModal ? `${assignModal.name} · ${assignModal.assetTag}` : ''}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAssignModal(null)}>
              Cancel
            </button>
            <button type="submit" form="assign-form" className="btn btn-primary" disabled={busy}>
              Assign
            </button>
          </>
        }
      >
        <form id="assign-form" onSubmit={assign} className="space-y-4">
          <Select
            label="Employee"
            required
            placeholder="Select employee"
            value={assignForm.employee}
            onChange={(event) => setAssignForm({ ...assignForm, employee: event.target.value })}
            options={employees.map((item) => ({ value: item.value, label: item.label }))}
          />
          <FormGrid columns={2}>
            <Input label="Expected return date" type="date" value={assignForm.expectedReturnDate} onChange={(event) => setAssignForm({ ...assignForm, expectedReturnDate: event.target.value })} />
            <Select
              label="Condition at handover"
              value={assignForm.condition}
              onChange={(event) => setAssignForm({ ...assignForm, condition: event.target.value })}
              options={['NEW', 'GOOD', 'FAIR', 'DAMAGED'].map((value) => ({ value, label: formatEnum(value) }))}
            />
          </FormGrid>
          <Textarea label="Notes" rows={2} value={assignForm.notes} onChange={(event) => setAssignForm({ ...assignForm, notes: event.target.value })} />
        </form>
      </Modal>

      <Modal
        open={Boolean(returnModal)}
        onClose={() => setReturnModal(null)}
        title="Return asset"
        description={returnModal ? `${returnModal.name} · ${returnModal.assetTag}` : ''}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setReturnModal(null)}>
              Cancel
            </button>
            <button type="submit" form="return-form" className="btn btn-primary" disabled={busy}>
              Record return
            </button>
          </>
        }
      >
        <form id="return-form" onSubmit={returnAsset} className="space-y-4">
          <FormGrid columns={2}>
            <Select
              label="Condition on return"
              value={returnForm.condition}
              onChange={(event) => setReturnForm({ ...returnForm, condition: event.target.value })}
              options={['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE'].map((value) => ({ value, label: formatEnum(value) }))}
            />
            <Select
              label="Next status"
              value={returnForm.status}
              onChange={(event) => setReturnForm({ ...returnForm, status: event.target.value })}
              options={['AVAILABLE', 'IN_REPAIR', 'RETIRED'].map((value) => ({ value, label: formatEnum(value) }))}
            />
          </FormGrid>
          <Textarea label="Notes" rows={2} value={returnForm.notes} onChange={(event) => setReturnForm({ ...returnForm, notes: event.target.value })} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmRetire)}
        onClose={() => setConfirmRetire(null)}
        onConfirm={retire}
        title="Retire asset"
        message={`Retire '${confirmRetire?.name || ''}' from the asset register? Assigned assets must be returned first.`}
        confirmLabel="Retire asset"
        variant="danger"
        loading={busy}
      />
    </div>
  );
};

export default AssetsPage;
