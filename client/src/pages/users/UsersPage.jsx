import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { KeyRound, Plus, Search, UserCog, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Field';
import { RoleBadge, Badge } from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import { toast } from '../../store/uiSlice';
import { userService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import useAuth from '../../hooks/useAuth';
import { ROLES, ROLE_LABELS } from '../../utils/constants';
import { formatDateTime } from '../../utils/format';

const emptyUser = { name: '', email: '', password: '', role: 'EMPLOYEE', phone: '' };

const UsersPage = () => {
  const dispatch = useDispatch();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole(ROLES.SUPER_ADMIN);
  const [filters, setFilters] = useState({ search: '', role: '', isActive: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(emptyUser);
  const [roleModal, setRoleModal] = useState(null);
  const [roleValue, setRoleValue] = useState('EMPLOYEE');
  const [passwordModal, setPasswordModal] = useState(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [confirmUser, setConfirmUser] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await userService.list({ ...filters, page, limit: 20 });
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

  const createUser = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await userService.create(createForm);
      dispatch(toast('User account created'));
      setCreateModal(false);
      setCreateForm(emptyUser);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const saveRole = async () => {
    setBusy(true);
    try {
      await userService.changeRole(roleModal.id, roleValue);
      dispatch(toast('Role updated'));
      setRoleModal(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setBusy(true);
    try {
      await userService.resetPassword(passwordModal.id, passwordValue);
      dispatch(toast('Password reset. User must change it at next sign in.'));
      setPasswordModal(null);
      setPasswordValue('');
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (user) => {
    try {
      await userService.setStatus(user.id, !user.isActive);
      dispatch(toast(`Account ${user.isActive ? 'deactivated' : 'activated'}`));
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const deleteUser = async () => {
    setBusy(true);
    try {
      await userService.remove(confirmUser.id);
      dispatch(toast('User account removed'));
      setConfirmUser(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Account',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} />
          <div>
            <p className="font-medium text-slate-900">{row.name}</p>
            <p className="text-xs text-slate-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (row) => <RoleBadge role={row.role} /> },
    {
      key: 'employee',
      header: 'Employee',
      render: (row) =>
        row.employee ? (
          <span className="text-sm">
            {row.employee.employeeId} · {row.employee.firstName} {row.employee.lastName}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Not linked</span>
        ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>
          {row.isActive ? 'Active' : 'Deactivated'}
        </Badge>
      ),
    },
    { key: 'lastLoginAt', header: 'Last sign in', render: (row) => (row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Never') },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {isSuperAdmin ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title="Change role"
              onClick={() => {
                setRoleModal(row);
                setRoleValue(row.role);
              }}
            >
              <UserCog size={14} />
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Reset password"
            onClick={() => setPasswordModal(row)}
          >
            <KeyRound size={14} />
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleStatus(row)}>
            {row.isActive ? 'Deactivate' : 'Activate'}
          </button>
          {isSuperAdmin ? (
            <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setConfirmUser(row)}>
              Remove
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="User accounts"
        description="Manage login accounts, roles and access status. Roles map to the permission matrix enforced by the API."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'User accounts' }]}
        actions={
          isSuperAdmin ? (
            <button type="button" className="btn btn-primary" onClick={() => setCreateModal(true)}>
              <Plus size={16} /> Create account
            </button>
          ) : (
            <span className="chip bg-amber-50 text-amber-700">
              <ShieldCheck size={13} /> Only super admins can create accounts
            </span>
          )
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 p-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field pl-9"
              placeholder="Search accounts by name or email"
              value={filters.search}
              onChange={(event) => {
                setPage(1);
                setFilters({ ...filters, search: event.target.value });
              }}
            />
          </div>
          <Select
            placeholder="All roles"
            value={filters.role}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, role: event.target.value });
            }}
            options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            placeholder="All statuses"
            value={filters.isActive}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, isActive: event.target.value });
            }}
            options={[
              { value: 'true', label: 'Active only' },
              { value: 'false', label: 'Deactivated only' },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Accounts" description={`${data.pagination?.total ?? 0} user accounts`} />
        <DataTable
          columns={columns}
          rows={data.items}
          loading={loading}
          pagination={data.pagination}
          onPageChange={setPage}
          emptyTitle="No user accounts found"
        />
      </Card>

      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Create user account"
        description="Accounts can be linked to an existing employee record after creation."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateModal(false)}>
              Cancel
            </button>
            <button type="submit" form="create-user-form" className="btn btn-primary" disabled={busy}>
              Create account
            </button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={createUser} className="space-y-4">
          <Input label="Full name" required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
          <Input label="Email" type="email" required value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
          <Input
            label="Temporary password"
            type="text"
            required
            hint="Minimum 8 characters including a letter and a number."
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
          />
          <Select
            label="Role"
            value={createForm.role}
            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
            options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Input label="Phone" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
        </form>
      </Modal>

      <Modal
        open={Boolean(roleModal)}
        onClose={() => setRoleModal(null)}
        title="Change role"
        description={roleModal?.email}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRoleModal(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={saveRole} disabled={busy}>
              Update role
            </button>
          </>
        }
      >
        <Select
          label="Role"
          value={roleValue}
          onChange={(event) => setRoleValue(event.target.value)}
          options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <p className="mt-2 text-xs text-slate-500">Role changes take effect on the next API request for that user.</p>
      </Modal>

      <Modal
        open={Boolean(passwordModal)}
        onClose={() => setPasswordModal(null)}
        title="Reset password"
        description={passwordModal?.email}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPasswordModal(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={resetPassword} disabled={busy || passwordValue.length < 8}>
              Reset password
            </button>
          </>
        }
      >
        <Input
          label="New password"
          type="text"
          required
          hint="The user will be required to change this password at next sign in."
          value={passwordValue}
          onChange={(event) => setPasswordValue(event.target.value)}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmUser)}
        onClose={() => setConfirmUser(null)}
        onConfirm={deleteUser}
        title="Remove user account"
        message={`This deactivates ${confirmUser?.email} and revokes sessions. Historical records remain for audit.`}
        confirmLabel="Remove account"
        variant="danger"
        loading={busy}
      />
    </div>
  );
};

export default UsersPage;
