import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Plus, UserCheck } from 'lucide-react';
import { useDispatch } from 'react-redux';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Field';
import Avatar from '../../components/ui/Avatar';
import { toast } from '../../store/uiSlice';
import { employeeService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import { formatDate } from '../../utils/format';
import { EMPLOYMENT_STATUS_LABELS } from '../../utils/constants';

const OnboardingPage = () => {
  const dispatch = useDispatch();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [newTask, setNewTask] = useState({ title: '', owner: 'HR', dueDate: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await employeeService.list({ limit: 100, page: 1 });
      const withTasks = (data.items || []).filter((employee) => employee.onboardingTasks?.length);
      setEmployees(withTasks);
      if (selected) {
        const refreshed = withTasks.find((item) => item._id === selected._id);
        setSelected(refreshed || null);
      }
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, selected]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = employees.reduce((sum, employee) => sum + (employee.onboardingTasks?.length || 0), 0);
    const completed = employees.reduce(
      (sum, employee) => sum + (employee.onboardingTasks || []).filter((task) => task.completed).length,
      0,
    );
    return { total, completed, progress: total ? Math.round((completed / total) * 100) : 0 };
  }, [employees]);

  const toggleTask = async (task) => {
    if (!selected) return;
    setBusy(true);
    try {
      await employeeService.updateTask(selected._id, task._id, { completed: !task.completed });
      await load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const addTask = async () => {
    if (!selected || !newTask.title.trim()) return;
    setBusy(true);
    try {
      await employeeService.addTask(selected._id, {
        title: newTask.title,
        owner: newTask.owner,
        dueDate: newTask.dueDate || undefined,
      });
      setNewTask({ title: '', owner: 'HR', dueDate: '' });
      await load();
      dispatch(toast('Task added to onboarding checklist'));
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

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
            <p className="text-xs text-slate-500">
              {row.employeeId} · {row.department?.name || '—'}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'dateOfJoining', header: 'Joined', render: (row) => formatDate(row.dateOfJoining) },
    { key: 'status', header: 'Status', render: (row) => EMPLOYMENT_STATUS_LABELS[row.employmentStatus] || row.employmentStatus },
    {
      key: 'progress',
      header: 'Onboarding progress',
      render: (row) => {
        const tasks = row.onboardingTasks || [];
        const done = tasks.filter((task) => task.completed).length;
        const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
        return (
          <div className="w-40">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {done}/{tasks.length}
              </span>
              <span>{percent}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-navy-700" style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(row)}>
          Manage
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Track joining formalities and documentation checklists for new employees."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Onboarding' }]}
        actions={
          <span className="chip bg-navy-50 text-navy-800">
            <UserCheck size={13} /> {stats.progress}% complete overall
          </span>
        }
      />

      <Card>
        <CardHeader title="Employees in onboarding" description={`${employees.length} records with checklists`} />
        <DataTable columns={columns} rows={employees} loading={loading} emptyTitle="No onboarding checklists" />
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Onboarding · ${selected.firstName} ${selected.lastName}` : 'Onboarding'}
        description={selected ? `${selected.employeeId} · joined ${formatDate(selected.dateOfJoining)}` : ''}
        size="lg"
      >
        {selected ? (
          <div className="space-y-4">
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {(selected.onboardingTasks || []).map((task) => (
                <button
                  key={task._id}
                  type="button"
                  disabled={busy}
                  onClick={() => toggleTask(task)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                >
                  {task.completed ? (
                    <CheckCircle2 size={17} className="text-emerald-600" />
                  ) : (
                    <Circle size={17} className="text-slate-300" />
                  )}
                  <span className="flex-1">
                    <span className={`block text-sm ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                      {task.title}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Owner {task.owner}
                      {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}
                    </span>
                  </span>
                </button>
              ))}
              {!(selected.onboardingTasks || []).length ? (
                <p className="px-3 py-4 text-sm text-slate-500">No tasks on this checklist.</p>
              ) : null}
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Add a task</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(event) => setNewTask({ ...newTask, title: event.target.value })}
                />
                <Select
                  value={newTask.owner}
                  onChange={(event) => setNewTask({ ...newTask, owner: event.target.value })}
                  options={[
                    { value: 'HR', label: 'HR' },
                    { value: 'EMPLOYEE', label: 'Employee' },
                    { value: 'ADMIN', label: 'Admin' },
                    { value: 'MANAGER', label: 'Manager' },
                  ]}
                />
                <Input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(event) => setNewTask({ ...newTask, dueDate: event.target.value })}
                />
              </div>
              <button type="button" className="btn btn-primary btn-sm mt-3" onClick={addTask} disabled={busy}>
                <Plus size={14} /> Add task
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default OnboardingPage;
