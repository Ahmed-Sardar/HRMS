import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { ArrowLeft, Plus, Save, Send, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Input, Select, Textarea, FormGrid } from '../../components/ui/Field';
import Alert from '../../components/ui/Alert';
import { PageLoader } from '../../components/ui/Loader';
import { toast } from '../../store/uiSlice';
import { performanceService } from '../../services/performance.service';
import { getErrorMessage } from '../../services/api';
import { formatDate } from '../../utils/format';

const toDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

const defaultValues = {
  title: '',
  periodType: 'MONTHLY',
  periodStart: '',
  periodEnd: '',
  overallRating: 0,
  selfAssessment: '',
  achievements: '',
  projectContributions: '',
  challenges: '',
  skillsDevelopment: '',
  employeeComments: '',
  goals: [{ title: '', description: '', weight: 25, target: '', achievement: '', rating: 0, status: 'IN_PROGRESS' }],
  tasksCompleted: [{ title: '', description: '', status: 'COMPLETED', priority: 'MEDIUM', completionDate: '' }],
  kpis: [{ name: '', target: '', achieved: '', unit: '', score: 0 }],
};

const ReportEditorPage = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues });
  const { fields: goals, append: addGoal, remove: removeGoal } = useFieldArray({ control, name: 'goals' });
  const { fields: tasks, append: addTask, remove: removeTask } = useFieldArray({ control, name: 'tasksCompleted' });
  const { fields: kpis, append: addKpi, remove: removeKpi } = useFieldArray({ control, name: 'kpis' });

  useEffect(() => {
    if (!isEdit) return;
    performanceService
      .get(id)
      .then(({ report }) => {
        reset({
          title: report.title,
          periodType: report.periodType,
          periodStart: toDate(report.periodStart),
          periodEnd: toDate(report.periodEnd),
          overallRating: report.overallRating || 0,
          selfAssessment: report.selfAssessment || '',
          achievements: report.achievements || '',
          projectContributions: report.projectContributions || '',
          challenges: report.challenges || '',
          skillsDevelopment: report.skillsDevelopment || '',
          employeeComments: report.employeeComments || '',
          goals: report.goals?.length
            ? report.goals.map((goal) => ({
                title: goal.title,
                description: goal.description || '',
                weight: goal.weight || 0,
                target: goal.target || '',
                achievement: goal.achievement || '',
                rating: goal.rating || 0,
                status: goal.status || 'IN_PROGRESS',
              }))
            : defaultValues.goals,
          tasksCompleted: report.tasksCompleted?.length
            ? report.tasksCompleted.map((task) => ({
                title: task.title,
                description: task.description || '',
                status: task.status || 'COMPLETED',
                priority: task.priority || 'MEDIUM',
                completionDate: toDate(task.completionDate),
              }))
            : defaultValues.tasksCompleted,
          kpis: report.kpis?.length
            ? report.kpis.map((kpi) => ({
                name: kpi.name,
                target: kpi.target || '',
                achieved: kpi.achieved || '',
                unit: kpi.unit || '',
                score: kpi.score || 0,
              }))
            : defaultValues.kpis,
        });
        if (report.status === 'DRAFT' || report.status === 'CORRECTION_REQUESTED') {
          if (report.financeComments) setError(`Finance comments: ${report.financeComments}`);
        }
      })
      .catch((err) => dispatch(toast(getErrorMessage(err), 'error')))
      .finally(() => setLoading(false));
  }, [dispatch, id, isEdit, reset]);

  const submit = async (values, shouldSubmit) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        overallRating: Number(values.overallRating) || 0,
        goals: values.goals.map((goal) => ({
          ...goal,
          weight: Number(goal.weight) || 0,
          rating: Number(goal.rating) || 0,
        })),
        kpis: values.kpis
          .filter((kpi) => kpi.name?.trim())
          .map((kpi) => ({ ...kpi, score: Number(kpi.score) || 0 })),
        tasksCompleted: values.tasksCompleted.filter((task) => task.title?.trim()),
      };
      let reportId = id;
      if (isEdit) {
        await performanceService.update(id, payload);
      } else {
        const created = await performanceService.create(payload);
        reportId = created._id;
      }
      if (shouldSubmit) {
        await performanceService.submit(reportId);
        dispatch(toast('Report submitted to Finance for verification'));
      } else {
        dispatch(toast('Report saved as draft'));
      }
      navigate(`/performance/reports/${reportId}`);
    } catch (err) {
      dispatch(toast(getErrorMessage(err), 'error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader label="Loading report..." />;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit performance report' : 'New performance report'}
        description="Capture goals, KPI results and achievements for the reporting period. Attendance and leave data are added automatically by the system."
        breadcrumb={[{ label: 'Performance reports', to: '/performance/reports' }, { label: isEdit ? 'Edit' : 'New' }]}
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={15} /> Back
          </button>
        }
      />

      {error ? (
        <Alert tone="warning" className="mb-4">
          {error}
        </Alert>
      ) : null}

      <form className="space-y-4">
        <Card>
          <CardHeader title="Report period" description="Choose the period this report covers" />
          <div className="p-5">
            <FormGrid columns={4}>
              <Input
                label="Report title"
                required
                className="sm:col-span-2"
                error={errors.title?.message}
                {...register('title', { required: 'Report title is required' })}
              />
              <Select
                label="Period type"
                options={[
                  { value: 'MONTHLY', label: 'Monthly' },
                  { value: 'QUARTERLY', label: 'Quarterly' },
                  { value: 'ANNUAL', label: 'Annual' },
                ]}
                {...register('periodType', { required: true })}
              />
              <Input label="Overall self rating (0-5)" type="number" step="0.1" min="0" max="5" {...register('overallRating')} />
              <Input label="Period start" type="date" required {...register('periodStart', { required: true })} />
              <Input label="Period end" type="date" required {...register('periodEnd', { required: true })} />
            </FormGrid>
            <p className="mt-3 text-xs text-slate-500">
              Today is {formatDate(new Date())}. Reports can be submitted to Finance once at least one goal or KPI is added.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Goals & objectives"
            description="Weights should total 100%"
            actions={
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addGoal({ title: '', weight: 0, status: 'IN_PROGRESS' })}>
                <Plus size={14} /> Add goal
              </button>
            }
          />
          <div className="space-y-4 p-5">
            {goals.map((goal, index) => (
              <div key={goal.id} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Goal {index + 1}</p>
                  {goals.length > 1 ? (
                    <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => removeGoal(index)}>
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
                <FormGrid columns={2}>
                  <Input label="Goal title" required {...register(`goals.${index}.title`, { required: true })} />
                  <Input label="Weight (%)" type="number" min="0" max="100" {...register(`goals.${index}.weight`)} />
                  <Input label="Target" {...register(`goals.${index}.target`)} />
                  <Input label="Achievement" {...register(`goals.${index}.achievement`)} />
                  <Input label="Rating (0-5)" type="number" step="0.1" min="0" max="5" {...register(`goals.${index}.rating`)} />
                  <Select
                    label="Status"
                    options={[
                      { value: 'NOT_STARTED', label: 'Not started' },
                      { value: 'IN_PROGRESS', label: 'In progress' },
                      { value: 'COMPLETED', label: 'Completed' },
                      { value: 'AT_RISK', label: 'At risk' },
                    ]}
                    {...register(`goals.${index}.status`)}
                  />
                  <Textarea label="Description" rows={2} className="sm:col-span-2" {...register(`goals.${index}.description`)} />
                </FormGrid>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="KPIs"
            description="Measurable indicators with targets and scores"
            actions={
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addKpi({ name: '', score: 0 })}>
                <Plus size={14} /> Add KPI
              </button>
            }
          />
          <div className="space-y-3 p-5">
            {kpis.map((kpi, index) => (
              <div key={kpi.id} className="grid gap-2 sm:grid-cols-6">
                <Input className="sm:col-span-2" placeholder="KPI name" {...register(`kpis.${index}.name`)} />
                <Input placeholder="Target" {...register(`kpis.${index}.target`)} />
                <Input placeholder="Achieved" {...register(`kpis.${index}.achieved`)} />
                <Input placeholder="Score 0-100" type="number" min="0" max="100" {...register(`kpis.${index}.score`)} />
                <div className="flex items-center justify-end">
                  <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => removeKpi(index)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Tasks completed"
            description="Key deliverables finished in this period"
            actions={
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTask({ title: '', status: 'COMPLETED', priority: 'MEDIUM' })}>
                <Plus size={14} /> Add task
              </button>
            }
          />
          <div className="space-y-3 p-5">
            {tasks.map((task, index) => (
              <div key={task.id} className="grid gap-2 sm:grid-cols-5">
                <Input className="sm:col-span-2" placeholder="Task title" {...register(`tasksCompleted.${index}.title`)} />
                <Select
                  options={[
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'IN_PROGRESS', label: 'In progress' },
                    { value: 'COMPLETED', label: 'Completed' },
                    { value: 'DEFERRED', label: 'Deferred' },
                  ]}
                  {...register(`tasksCompleted.${index}.status`)}
                />
                <Select
                  options={[
                    { value: 'LOW', label: 'Low' },
                    { value: 'MEDIUM', label: 'Medium' },
                    { value: 'HIGH', label: 'High' },
                    { value: 'CRITICAL', label: 'Critical' },
                  ]}
                  {...register(`tasksCompleted.${index}.priority`)}
                />
                <div className="flex items-center gap-1">
                  <Input type="date" {...register(`tasksCompleted.${index}.completionDate`)} />
                  <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => removeTask(index)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Narrative" description="Self assessment, achievements and challenges" />
          <div className="p-5">
            <FormGrid columns={1}>
              <Textarea label="Self assessment" rows={4} {...register('selfAssessment')} />
              <Textarea label="Achievements" rows={3} {...register('achievements')} />
              <Textarea label="Project contributions" rows={3} {...register('projectContributions')} />
              <Textarea label="Challenges" rows={3} {...register('challenges')} />
              <Textarea label="Skills development" rows={3} {...register('skillsDevelopment')} />
              <Textarea label="Employee comments" rows={2} {...register('employeeComments')} />
            </FormGrid>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/performance/reports')}>
              Cancel
            </button>
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={handleSubmit((values) => submit(values, false))}>
              <Save size={16} /> Save draft
            </button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSubmit((values) => submit(values, true))}>
              <Send size={16} /> Save & submit to Finance
            </button>
          </div>
        </Card>
      </form>
    </div>
  );
};

export default ReportEditorPage;
