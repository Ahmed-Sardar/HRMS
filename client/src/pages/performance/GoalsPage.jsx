import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Target, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Loader';
import { toast } from '../../store/uiSlice';
import { performanceService } from '../../services/performance.service';
import { getErrorMessage } from '../../services/api';
import { formatDate } from '../../utils/format';

const statusOptions = [
  { value: 'NOT_STARTED', label: 'Not started' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'ACHIEVED', label: 'Achieved' },
  { value: 'PARTIALLY_ACHIEVED', label: 'Partially achieved' },
  { value: 'MISSED', label: 'Missed' },
];

const emptyGoal = {
  title: '',
  description: '',
  category: 'BUSINESS',
  weight: 20,
  targetDate: '',
  periodStart: '',
  periodEnd: '',
};

const GoalsPage = () => {
  const dispatch = useDispatch();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyGoal);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGoals(await performanceService.goals());
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await performanceService.createGoal({
        ...form,
        targetDate: form.targetDate || undefined,
        periodStart: form.periodStart || undefined,
        periodEnd: form.periodEnd || undefined,
      });
      dispatch(toast('Goal created'));
      setModal(false);
      setForm(emptyGoal);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const updateProgress = async (goal, progress) => {
    try {
      await performanceService.updateGoal(goal._id, {
        progress: Number(progress),
        status: Number(progress) >= 100 ? 'ACHIEVED' : 'IN_PROGRESS',
      });
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await performanceService.deleteGoal(confirm._id);
      dispatch(toast('Goal deleted'));
      setConfirm(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Performance goals"
        description="Track objectives across the year and keep progress updated."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Goals' }]}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setModal(true)}>
            <Plus size={16} /> New goal
          </button>
        }
      />

      {loading ? <PageLoader label="Loading goals..." /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {goals.map((goal) => (
          <Card key={goal._id} className="flex flex-col">
            <div className="flex-1 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-800">
                    <Target size={15} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{goal.title}</p>
                    <p className="text-xs text-slate-500">{goal.category}</p>
                  </div>
                </div>
                <Badge tone={goal.status === 'ACHIEVED' ? 'bg-emerald-50 text-emerald-700' : goal.status === 'MISSED' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}>
                  {goal.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              {goal.description ? <p className="mt-3 line-clamp-2 text-sm text-slate-600">{goal.description}</p> : null}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Progress</span>
                  <span>{goal.progress || 0}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-navy-700" style={{ width: `${goal.progress || 0}%` }} />
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  defaultValue={goal.progress || 0}
                  onMouseUp={(event) => updateProgress(goal, event.target.value)}
                  onTouchEnd={(event) => updateProgress(goal, event.target.value)}
                  className="mt-2 w-full accent-navy-800"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Weight {goal.weight || 0}%</span>
                {goal.targetDate ? <span>· Due {formatDate(goal.targetDate)}</span> : null}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2.5">
              <span className="text-[11px] text-slate-400">Updated {formatDate(goal.updatedAt)}</span>
              <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setConfirm(goal)}>
                <Trash2 size={13} />
              </button>
            </div>
          </Card>
        ))}
        {!loading && !goals.length ? (
          <Card className="p-8 text-center md:col-span-2 xl:col-span-3">
            <p className="text-sm text-slate-500">No goals created yet. Add objectives to track progress across the year.</p>
            <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => setModal(true)}>
              <Plus size={14} /> Create goal
            </button>
          </Card>
        ) : null}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="New performance goal"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button type="submit" form="goal-form" className="btn btn-primary" disabled={busy}>
              Create goal
            </button>
          </>
        }
      >
        <form id="goal-form" onSubmit={save} className="space-y-4">
          <Input label="Goal title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={[
                { value: 'BUSINESS', label: 'Business' },
                { value: 'TECHNICAL', label: 'Technical' },
                { value: 'BEHAVIOURAL', label: 'Behavioural' },
                { value: 'LEARNING', label: 'Learning' },
                { value: 'DELIVERY', label: 'Delivery' },
              ]}
            />
            <Input label="Weight (%)" type="number" min="0" max="100" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            <Input label="Target date" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
            <Input label="Period start" type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
            <Input label="Period end" type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        title="Delete goal"
        message={`Delete the goal "${confirm?.title}"?`}
        confirmLabel="Delete"
        variant="danger"
        loading={busy}
      />
    </div>
  );
};

export default GoalsPage;
