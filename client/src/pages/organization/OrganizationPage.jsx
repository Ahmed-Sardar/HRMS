import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Pencil, Trash2, Building2, BadgeCheck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import DataTable from '../../components/ui/DataTable';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import {
  departmentService,
  designationService,
  employeeService,
} from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';

const emptyDepartment = { name: '', code: '', description: '', email: '', head: '', isActive: true };
const emptyDesignation = { title: '', code: '', department: '', level: '', description: '', minSalary: '', maxSalary: '', isActive: true };

const OrganizationPage = () => {
  const dispatch = useDispatch();
  const [tab, setTab] = useState('departments');
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deptModal, setDeptModal] = useState(false);
  const [desigModal, setDesigModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [editingDesig, setEditingDesig] = useState(null);
  const [deptForm, setDeptForm] = useState(emptyDepartment);
  const [desigForm, setDesigForm] = useState(emptyDesignation);
  const [confirmDept, setConfirmDept] = useState(null);
  const [confirmDesig, setConfirmDesig] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, desigRes, managerRes] = await Promise.all([
        departmentService.list({ limit: 100, includeInactive: 'true' }),
        designationService.list({ includeInactive: 'true' }),
        employeeService.options(),
      ]);
      setDepartments(deptRes.items || []);
      setDesignations(desigRes || []);
      setManagers(managerRes || []);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const openDept = (department) => {
    setEditingDept(department || null);
    setDeptForm(
      department
        ? {
            name: department.name,
            code: department.code,
            description: department.description || '',
            email: department.email || '',
            head: department.head?._id || '',
            isActive: department.isActive,
          }
        : emptyDepartment,
    );
    setDeptModal(true);
  };

  const saveDept = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (editingDept) {
        await departmentService.update(editingDept._id, deptForm);
        dispatch(toast('Department updated'));
      } else {
        await departmentService.create(deptForm);
        dispatch(toast('Department created'));
      }
      setDeptModal(false);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const openDesig = (designation) => {
    setEditingDesig(designation || null);
    setDesigForm(
      designation
        ? {
            title: designation.title,
            code: designation.code,
            department: designation.department?._id || '',
            level: designation.level || '',
            description: designation.description || '',
            minSalary: designation.minSalary || '',
            maxSalary: designation.maxSalary || '',
            isActive: designation.isActive,
          }
        : emptyDesignation,
    );
    setDesigModal(true);
  };

  const saveDesig = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (editingDesig) {
        await designationService.update(editingDesig._id, desigForm);
        dispatch(toast('Designation updated'));
      } else {
        await designationService.create(desigForm);
        dispatch(toast('Designation created'));
      }
      setDesigModal(false);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const removeDept = async () => {
    setBusy(true);
    try {
      await departmentService.remove(confirmDept._id);
      dispatch(toast('Department deactivated'));
      setConfirmDept(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const removeDesig = async () => {
    setBusy(true);
    try {
      await designationService.remove(confirmDesig._id);
      dispatch(toast('Designation deactivated'));
      setConfirmDesig(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const departmentColumns = [
    { key: 'name', header: 'Department', render: (row) => <span className="font-medium text-slate-900">{row.name}</span> },
    { key: 'code', header: 'Code', render: (row) => <span className="font-mono text-xs">{row.code}</span> },
    {
      key: 'head',
      header: 'Head',
      render: (row) => (row.head ? `${row.head.firstName} ${row.head.lastName}` : '—'),
    },
    { key: 'employeeCount', header: 'Employees', render: (row) => row.employeeCount ?? 0 },
    { key: 'isActive', header: 'Status', render: (row) => <Badge tone={row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDept(row)}>
            <Pencil size={14} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setConfirmDept(row)}>
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const designationColumns = [
    { key: 'title', header: 'Designation', render: (row) => <span className="font-medium text-slate-900">{row.title}</span> },
    { key: 'code', header: 'Code', render: (row) => <span className="font-mono text-xs">{row.code}</span> },
    { key: 'department', header: 'Department', render: (row) => row.department?.name || '—' },
    { key: 'level', header: 'Level', render: (row) => row.level || '—' },
    {
      key: 'salary',
      header: 'Salary band',
      render: (row) => (row.minSalary || row.maxSalary ? `${row.minSalary || 0} - ${row.maxSalary || '—'}` : '—'),
    },
    { key: 'isActive', header: 'Status', render: (row) => <Badge tone={row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDesig(row)}>
            <Pencil size={14} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setConfirmDesig(row)}>
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Organization structure"
        description="Maintain departments, reporting heads and the designation hierarchy."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Organization' }]}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => (tab === 'departments' ? openDept(null) : openDesig(null))}
          >
            <Plus size={16} /> Add {tab === 'departments' ? 'department' : 'designation'}
          </button>
        }
      />

      <Card>
        <div className="px-4 pt-2">
          <Tabs
            items={[
              { key: 'departments', label: 'Departments', count: departments.length },
              { key: 'designations', label: 'Designations', count: designations.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        {tab === 'departments' ? (
          <DataTable
            columns={departmentColumns}
            rows={departments}
            loading={loading}
            emptyTitle="No departments"
            emptyDescription="Create your first department to start organizing employees."
          />
        ) : (
          <DataTable
            columns={designationColumns}
            rows={designations}
            loading={loading}
            emptyTitle="No designations"
            emptyDescription="Designations define job titles within departments."
          />
        )}
      </Card>

      <Modal
        open={deptModal}
        onClose={() => setDeptModal(false)}
        title={editingDept ? 'Edit department' : 'New department'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDeptModal(false)}>
              Cancel
            </button>
            <button type="submit" form="department-form" className="btn btn-primary" disabled={busy}>
              Save department
            </button>
          </>
        }
      >
        <form id="department-form" onSubmit={saveDept} className="space-y-4">
          <Input label="Name" required value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
          <Input label="Code" required placeholder="ENG" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} />
          <Select
            label="Department head"
            placeholder="Not assigned"
            value={deptForm.head}
            onChange={(e) => setDeptForm({ ...deptForm, head: e.target.value })}
            options={managers.map((item) => ({ value: item.value, label: item.label }))}
          />
          <Input label="Email" type="email" value={deptForm.email} onChange={(e) => setDeptForm({ ...deptForm, email: e.target.value })} />
          <Textarea label="Description" rows={3} value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} />
        </form>
      </Modal>

      <Modal
        open={desigModal}
        onClose={() => setDesigModal(false)}
        title={editingDesig ? 'Edit designation' : 'New designation'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDesigModal(false)}>
              Cancel
            </button>
            <button type="submit" form="designation-form" className="btn btn-primary" disabled={busy}>
              Save designation
            </button>
          </>
        }
      >
        <form id="designation-form" onSubmit={saveDesig} className="space-y-4">
          <Input label="Title" required value={desigForm.title} onChange={(e) => setDesigForm({ ...desigForm, title: e.target.value })} />
          <Input label="Code" required value={desigForm.code} onChange={(e) => setDesigForm({ ...desigForm, code: e.target.value })} />
          <Select
            label="Department"
            placeholder="Select department"
            value={desigForm.department}
            onChange={(e) => setDesigForm({ ...desigForm, department: e.target.value })}
            options={departments.map((dept) => ({ value: dept._id, label: dept.name }))}
          />
          <Input label="Level" placeholder="L3" value={desigForm.level} onChange={(e) => setDesigForm({ ...desigForm, level: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Min salary" type="number" value={desigForm.minSalary} onChange={(e) => setDesigForm({ ...desigForm, minSalary: e.target.value })} />
            <Input label="Max salary" type="number" value={desigForm.maxSalary} onChange={(e) => setDesigForm({ ...desigForm, maxSalary: e.target.value })} />
          </div>
          <Textarea label="Description" rows={3} value={desigForm.description} onChange={(e) => setDesigForm({ ...desigForm, description: e.target.value })} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDept)}
        onClose={() => setConfirmDept(null)}
        onConfirm={removeDept}
        title="Deactivate department"
        message={`Deactivate ${confirmDept?.name}? Departments with active employees cannot be removed.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={busy}
      />
      <ConfirmDialog
        open={Boolean(confirmDesig)}
        onClose={() => setConfirmDesig(null)}
        onConfirm={removeDesig}
        title="Deactivate designation"
        message={`Deactivate ${confirmDesig?.title}? Designations assigned to employees cannot be removed.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={busy}
      />
    </div>
  );
};

export default OrganizationPage;
