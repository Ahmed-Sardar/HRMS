import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  Download,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldAlert,
  Trash2,
  UserMinus,
  Wallet,
  Laptop,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Loader';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { Checkbox, Input, Select, Textarea } from '../../components/ui/Field';
import Alert from '../../components/ui/Alert';
import { toast } from '../../store/uiSlice';
import { employeeService } from '../../services/employee.service';
import { documentService } from '../../services/document.service';
import { getErrorMessage } from '../../services/api';
import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  formatEnum,
} from '../../utils/constants';
import { formatDate, formatDateTime, formatCurrency, fileSize } from '../../utils/format';
import useAuth from '../../hooks/useAuth';
import { ROLES } from '../../utils/constants';

const InfoRow = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-0.5 text-sm text-slate-800">{value || '—'}</p>
  </div>
);

const EmployeeDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { hasRole } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusModal, setStatusModal] = useState(false);
  const [offboardModal, setOffboardModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusValue, setStatusValue] = useState('ACTIVE');
  const [offboard, setOffboard] = useState({ lastWorkingDay: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', owner: 'HR' });
  const [emailModal, setEmailModal] = useState(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailHistory, setEmailHistory] = useState([]);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ employeeId: '', reason: '', password: '', acknowledged: false });
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const canManage = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR);
  const isSuperAdmin = hasRole(ROLES.SUPER_ADMIN);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await employeeService.get(id);
      setEmployee(data);
      setStatusValue(data.employmentStatus);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    if (canManage) {
      employeeService
        .emailHistory(id)
        .then((history) => setEmailHistory(history.items || []))
        .catch(() => setEmailHistory([]));
    }
  }, [id, canManage]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async () => {
    setBusy(true);
    try {
      await employeeService.setStatus(id, { employmentStatus: statusValue });
      dispatch(toast('Employment status updated'));
      setStatusModal(false);
      load();
    } catch (err) {
      dispatch(toast(getErrorMessage(err), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const handleOffboard = async () => {
    setBusy(true);
    try {
      await employeeService.offboard(id, offboard);
      dispatch(toast('Employee offboarded'));
      setOffboardModal(false);
      load();
    } catch (err) {
      dispatch(toast(getErrorMessage(err), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivate = async () => {
    setBusy(true);
    try {
      await employeeService.remove(id);
      dispatch(toast('Employee record deactivated'));
      navigate('/employees');
    } catch (err) {
      dispatch(toast(getErrorMessage(err), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const openPermanentDelete = () => {
    setDeleteError('');
    setDeleteForm({ employeeId: '', reason: '', password: '', acknowledged: false });
    setDeleteModal(true);
  };

  const canConfirmPermanentDelete =
    deleteForm.acknowledged &&
    deleteForm.employeeId.trim().toUpperCase() === (employee?.employeeId || '') &&
    deleteForm.reason.trim().length >= 10 &&
    deleteForm.password.length > 0;

  const handlePermanentDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const result = await employeeService.permanentDelete(id, {
        employeeId: deleteForm.employeeId.trim(),
        reason: deleteForm.reason.trim(),
        password: deleteForm.password,
        acknowledged: deleteForm.acknowledged,
      });
      dispatch(toast(`Employee permanently deleted (reference ${result.reference})`));
      setDeleteModal(false);
      navigate('/employees');
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const openEmailModal = (type) => {
    setEmailError('');
    setEmailModal({
      type,
      value: type === 'WORK' ? employee?.email || '' : employee?.personalEmail || '',
    });
  };

  const saveEmail = async () => {
    if (!emailModal) return;
    const value = emailModal.value.trim();
    if (!value) {
      setEmailError('Email is required');
      return;
    }
    setEmailSaving(true);
    setEmailError('');
    try {
      await employeeService.update(
        id,
        emailModal.type === 'WORK' ? { email: value } : { personalEmail: value },
      );
      dispatch(toast(emailModal.type === 'WORK' ? 'Official work email updated' : 'Personal email updated'));
      setEmailModal(null);
      load();
    } catch (err) {
      setEmailError(getErrorMessage(err));
    } finally {
      setEmailSaving(false);
    }
  };

  const toggleTask = async (task) => {
    try {
      await employeeService.updateTask(id, task._id, { completed: !task.completed });
      load();
    } catch (err) {
      dispatch(toast(getErrorMessage(err), 'error'));
    }
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      await employeeService.addTask(id, newTask);
      setNewTask({ title: '', owner: 'HR' });
      setTaskModal(false);
      load();
      dispatch(toast('Onboarding task added'));
    } catch (err) {
      dispatch(toast(getErrorMessage(err), 'error'));
    }
  };

  if (loading) return <PageLoader label="Loading employee profile..." />;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!employee) return null;

  const onboarding = employee.onboardingTasks || [];
  const completedTasks = onboarding.filter((task) => task.completed).length;

  return (
    <div>
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        description={`${employee.employeeId} · ${employee.designation?.title || 'No designation'}`}
        breadcrumb={[{ label: 'Employees', to: '/employees' }, { label: employee.employeeId }]}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/employees')}>
              <ArrowLeft size={15} /> Back
            </button>
            {canManage ? (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setStatusModal(true)}>
                  Change status
                </button>
                <Link to={`/employees/${id}/edit`} className="btn btn-primary">
                  <Pencil size={15} /> Edit
                </Link>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
            <Avatar name={`${employee.firstName} ${employee.lastName}`} src={employee.profilePhoto} size="lg" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">
                  {employee.firstName} {employee.lastName}
                </h2>
                <StatusBadge status={employee.employmentStatus} labels={EMPLOYMENT_STATUS_LABELS} />
                <span className="chip bg-slate-100 text-slate-600">{formatEnum(employee.employmentType)}</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail size={15} className="text-slate-400" /> {employee.email}
                </p>
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone size={15} className="text-slate-400" /> {employee.phone || '—'}
                </p>
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <Building2 size={15} className="text-slate-400" /> {employee.department?.name || '—'}
                </p>
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <Briefcase size={15} className="text-slate-400" /> {employee.designation?.title || '—'}
                </p>
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <CalendarDays size={15} className="text-slate-400" /> Joined {formatDate(employee.dateOfJoining)}
                </p>
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin size={15} className="text-slate-400" /> {employee.workLocation || '—'}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 border-t border-slate-200 px-5 py-4 sm:grid-cols-3">
            <InfoRow
              label="Reporting manager"
              value={
                employee.reportingManager
                  ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`
                  : '—'
              }
            />
            <InfoRow label="Employment type" value={formatEnum(employee.employmentType)} />
            <InfoRow label="Confirmation date" value={formatDate(employee.confirmationDate)} />
            <InfoRow label="Emergency contact" value={employee.emergencyContact?.name} />
            <InfoRow label="Emergency phone" value={employee.emergencyContact?.phone} />
            <InfoRow label="Personal email" value={employee.personalEmail} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Leave balance" description={`Year ${new Date().getFullYear()}`} />
          <div className="space-y-3 p-5">
            {employee.leaveBalance?.balances?.length ? (
              employee.leaveBalance.balances.map((entry) => (
                <div key={entry.type} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{formatEnum(entry.type)}</span>
                  <span className="font-medium text-slate-900">
                    {Math.max(0, entry.allocated + entry.carriedForward - entry.used - entry.pending)} / {entry.allocated}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No leave balance on record.</p>
            )}
          </div>
          <div className="space-y-2 border-t border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bank details</p>
            {employee.bankDetails?.accountNumber ? (
              <>
                <InfoRow label="Account" value={`${employee.bankDetails.accountNumber} · ${employee.bankDetails.bankName || ''}`} />
                <InfoRow label="IFSC" value={employee.bankDetails.ifscCode} />
              </>
            ) : (
              <p className="text-sm text-slate-500">Restricted or not provided.</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Email addresses"
          description="Saved to the employee record and, for the work email, to the linked login account"
        />
        <div className="divide-y divide-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Official work email</p>
              <p className="mt-0.5 break-all text-sm text-slate-800">{employee.email || '—'}</p>
              <p className="mt-0.5 text-xs text-slate-500">Used to sign in to the HRMS.</p>
            </div>
            {canManage ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEmailModal('WORK')}>
                <Pencil size={13} /> Edit
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Personal email</p>
              <p className="mt-0.5 break-all text-sm text-slate-800">{employee.personalEmail || '—'}</p>
              <p className="mt-0.5 text-xs text-slate-500">Used for personal correspondence only.</p>
            </div>
            {canManage ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEmailModal('PERSONAL')}>
                <Pencil size={13} /> Edit
              </button>
            ) : null}
          </div>
        </div>
        {canManage && emailHistory.length ? (
          <div className="border-t border-slate-200 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent email changes</p>
            <div className="mt-2 space-y-2">
              {emailHistory.slice(0, 5).map((entry) => (
                <div key={entry._id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-700">
                      {entry.emailType === 'WORK' ? 'Work email' : 'Personal email'}
                    </span>
                    <span className="text-slate-400">
                      {formatDateTime(entry.appliedAt || entry.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 break-all text-slate-600">
                    {entry.previousEmail || '—'} → {entry.newEmail}
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    {entry.changedByName || entry.requestedByName || 'System'} · {formatEnum(entry.status)}
                    {entry.verificationStatus === 'VERIFIED' ? ' · verified' : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Documents" description={`${employee.documents?.length || 0} uploaded`} />
          <div className="divide-y divide-slate-100">
            {(employee.documents || []).length ? (
              employee.documents.slice(0, 6).map((doc) => (
                <div key={doc._id} className="flex items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{doc.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatEnum(doc.category)} · {fileSize(doc.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      try {
                        await documentService.download(doc._id);
                      } catch (err) {
                        dispatch(toast(getErrorMessage(err), 'error'));
                      }
                    }}
                  >
                    <Download size={13} />
                  </button>
                </div>
              ))
            ) : (
              <p className="px-5 py-6 text-sm text-slate-500">No documents uploaded.</p>
            )}
          </div>
          <div className="border-t border-slate-100 px-5 py-3">
            <Link to="/documents" className="text-sm font-semibold text-navy-800 hover:underline">
              Manage documents
            </Link>
          </div>
        </Card>

        <Card>
          <CardHeader title="Assigned assets" description={`${employee.assets?.length || 0} items`} />
          <div className="divide-y divide-slate-100">
            {(employee.assets || []).length ? (
              employee.assets.map((asset) => (
                <div key={asset._id} className="flex items-center gap-3 px-5 py-3">
                  <Laptop size={16} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{asset.name}</p>
                    <p className="text-xs text-slate-500">
                      {asset.assetTag} · {asset.condition}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-5 py-6 text-sm text-slate-500">No assets assigned.</p>
            )}
          </div>
          <div className="border-t border-slate-100 px-5 py-3">
            <Link to="/assets" className="text-sm font-semibold text-navy-800 hover:underline">
              Asset registry
            </Link>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent leave" description="Requests raised" />
          <div className="divide-y divide-slate-100">
            {(employee.leaveBalance?.balances || []).length && (employee.reimbursements || []).length === 0 ? null : null}
            {(employee.reimbursements || []).length ? (
              employee.reimbursements.slice(0, 5).map((item) => (
                <div key={item._id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatEnum(item.category)} · {formatDate(item.expenseDate)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-slate-700">{formatCurrency(item.amount)}</span>
                </div>
              ))
            ) : (
              <p className="px-5 py-6 text-sm text-slate-500">No reimbursements raised.</p>
            )}
          </div>
        </Card>
      </div>

      {employee.onboardingTasks ? (
        <Card className="mt-4">
          <CardHeader
            title="Onboarding checklist"
            description={`${completedTasks} of ${onboarding.length} tasks completed`}
            actions={
              canManage ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTaskModal(true)}>
                  Add task
                </button>
              ) : null
            }
          />
          <div className="divide-y divide-slate-100">
            {onboarding.length ? (
              onboarding.map((task) => (
                <button
                  key={task._id}
                  type="button"
                  onClick={() => canManage && toggleTask(task)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
                >
                  {task.completed ? (
                    <CheckCircle2 size={17} className="text-emerald-600" />
                  ) : (
                    <Circle size={17} className="text-slate-300" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{task.title}</p>
                    <p className="text-xs text-slate-500">
                      Owner: {task.owner}
                      {task.dueDate ? ` · Due ${formatDate(task.dueDate)}` : ''}
                    </p>
                  </div>
                  {task.completedAt ? <span className="text-xs text-slate-400">{formatDate(task.completedAt)}</span> : null}
                </button>
              ))
            ) : (
              <p className="px-5 py-6 text-sm text-slate-500">No onboarding tasks.</p>
            )}
          </div>
        </Card>
      ) : null}

      {employee.offboarding?.reason ? (
        <Alert tone="warning" className="mt-4" title="Offboarding record">
          {employee.offboarding.reason} · Last working day {formatDate(employee.offboarding.lastWorkingDay)}
        </Alert>
      ) : null}

      {canManage ? (
        <Card className="mt-4">
          <CardHeader title="Sensitive actions" description="These actions affect the employee's access and history" />
          <div className="flex flex-wrap gap-2 p-5">
            <button type="button" className="btn btn-secondary" onClick={() => setOffboardModal(true)}>
              <UserMinus size={15} /> Offboard employee
            </button>
            {hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN) ? (
              <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                <ShieldAlert size={15} /> Deactivate record
              </button>
            ) : null}
            {isSuperAdmin ? (
              <button type="button" className="btn btn-danger" onClick={openPermanentDelete}>
                <Trash2 size={15} /> Permanently delete employee
              </button>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Modal
        open={statusModal}
        onClose={() => setStatusModal(false)}
        title="Change employment status"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setStatusModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleStatus} disabled={busy}>
              Update status
            </button>
          </>
        }
      >
        <Select
          label="Employment status"
          value={statusValue}
          onChange={(event) => setStatusValue(event.target.value)}
          options={Object.entries(EMPLOYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <p className="mt-2 text-xs text-slate-500">
          Terminating an employee deactivates their user account and revokes active sessions.
        </p>
      </Modal>

      <Modal
        open={offboardModal}
        onClose={() => setOffboardModal(false)}
        title="Offboard employee"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOffboardModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={handleOffboard} disabled={busy || !offboard.lastWorkingDay}>
              Confirm offboarding
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Last working day"
            type="date"
            required
            value={offboard.lastWorkingDay}
            onChange={(event) => setOffboard((prev) => ({ ...prev, lastWorkingDay: event.target.value }))}
          />
          <Input
            label="Reason"
            required
            placeholder="Resignation, contract completion..."
            value={offboard.reason}
            onChange={(event) => setOffboard((prev) => ({ ...prev, reason: event.target.value }))}
          />
          <Alert tone="warning">Assigned company assets will be marked as returned and the account will be deactivated.</Alert>
        </div>
      </Modal>

      <Modal
        open={deleteModal}
        onClose={() => (deleting ? null : setDeleteModal(false))}
        title="Permanently delete employee"
        description="Irreversible erasure of personal and authentication records"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDeleteModal(false)} disabled={deleting}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handlePermanentDelete}
              disabled={deleting || !canConfirmPermanentDelete}
            >
              {deleting ? 'Deleting...' : 'Permanently delete employee'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <InfoRow label="Employee" value={`${employee.firstName} ${employee.lastName}`} />
            <InfoRow label="Employee ID" value={employee.employeeId} />
            <InfoRow label="Work email" value={employee.email} />
            <InfoRow label="Department" value={employee.department?.name} />
            <InfoRow label="Designation" value={employee.designation?.title} />
          </div>

          <Alert tone="error" title="This action is permanent and cannot be undone">
            The employee's login account, sessions, personal profile details, attendance, leave balances,
            goals and uploaded documents are removed or anonymized. Payroll, payslips, reimbursements and
            audit records are retained as required for legal, financial and audit purposes.
          </Alert>

          {deleteError ? <Alert tone="error">{deleteError}</Alert> : null}

          <Checkbox
            id="permanent-delete-acknowledged"
            label="I understand that this permanently deletes the employee and cannot be reversed."
            checked={deleteForm.acknowledged}
            onChange={(event) => setDeleteForm((prev) => ({ ...prev, acknowledged: event.target.checked }))}
          />

          <Input
            label={`Type ${employee.employeeId} to confirm`}
            required
            placeholder={employee.employeeId}
            value={deleteForm.employeeId}
            onChange={(event) => setDeleteForm((prev) => ({ ...prev, employeeId: event.target.value }))}
          />

          <Textarea
            label="Deletion reason"
            required
            rows={3}
            placeholder="Why is this employee record being permanently deleted?"
            hint="At least 10 characters. Stored in the permanent deletion audit."
            value={deleteForm.reason}
            onChange={(event) => setDeleteForm((prev) => ({ ...prev, reason: event.target.value }))}
          />

          <Input
            label="Your password"
            type="password"
            required
            autoComplete="current-password"
            hint="Re-authentication is required because this action is irreversible."
            value={deleteForm.password}
            onChange={(event) => setDeleteForm((prev) => ({ ...prev, password: event.target.value }))}
          />
        </div>
      </Modal>

      <Modal
        open={taskModal}
        onClose={() => setTaskModal(false)}
        title="Add onboarding task"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setTaskModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={addTask}>
              Add task
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Task title" value={newTask.title} onChange={(event) => setNewTask((prev) => ({ ...prev, title: event.target.value }))} />
          <Select
            label="Owner"
            value={newTask.owner}
            onChange={(event) => setNewTask((prev) => ({ ...prev, owner: event.target.value }))}
            options={[
              { value: 'HR', label: 'HR' },
              { value: 'EMPLOYEE', label: 'Employee' },
              { value: 'ADMIN', label: 'Admin' },
              { value: 'MANAGER', label: 'Reporting manager' },
            ]}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(emailModal)}
        onClose={() => setEmailModal(null)}
        title={emailModal?.type === 'WORK' ? 'Update official work email' : 'Update personal email'}
        description={
          emailModal?.type === 'WORK'
            ? 'The employee will sign in with the new address. The linked login account is updated too.'
            : 'Personal contact address. It is not used to sign in.'
        }
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEmailModal(null)} disabled={emailSaving}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={saveEmail} disabled={emailSaving}>
              {emailSaving ? 'Saving...' : 'Save email'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {emailError ? <Alert tone="error">{emailError}</Alert> : null}
          <Input
            label="Email address"
            type="email"
            required
            value={emailModal?.value || ''}
            onChange={(event) => setEmailModal((prev) => ({ ...prev, value: event.target.value }))}
          />
          <p className="text-xs text-slate-500">
            Duplicate addresses and invalid formats are rejected. Every change is recorded in the email change history.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeactivate}
        title="Deactivate employee record"
        message="The employee record will be soft-deleted and the user account disabled. Historical attendance, payroll and approvals remain available for audit."
        confirmLabel="Deactivate"
        variant="danger"
        loading={busy}
      />
    </div>
  );
};

export default EmployeeDetailPage;
