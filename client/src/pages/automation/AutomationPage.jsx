import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { BellRing, CalendarCheck2, PlayCircle, RefreshCw, Sparkles, UserX } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Loader';
import { toast } from '../../store/uiSlice';
import { automationService } from '../../services/automation.service';
import { getErrorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/format';

const JOB_ICONS = {
  reminders: BellRing,
  'leave-accrual': CalendarCheck2,
  'auto-absent': UserX,
};

const summarize = (summary) => {
  if (!summary) return 'Not run yet';
  const parts = [];
  if (summary.date) parts.push(summary.date);
  if (summary.year) parts.push(`Year ${summary.year}`);
  if (summary.created) parts.push(`${summary.created} created`);
  if (summary.updated) parts.push(`${summary.updated} updated`);
  if (summary.marked) parts.push(`${summary.marked} marked absent`);
  if (summary.wouldMark) parts.push(`${summary.wouldMark} would be marked`);
  return parts.length ? parts.join(' · ') : 'Completed';
};

const AutomationPage = () => {
  const dispatch = useDispatch();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    try {
      setStatus(await automationService.status());
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key, action, successMessage) => {
    setBusy(key);
    try {
      const data = await action();
      dispatch(toast(typeof successMessage === 'function' ? successMessage(data) : successMessage));
      await load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy('');
    }
  };

  if (loading || !status) {
    return <PageLoader label="Loading automation status..." />;
  }

  return (
    <div>
      <PageHeader
        title="Automation"
        description="Scheduled jobs that keep leave balances, reminders and attendance records up to date without manual work."
        breadcrumb={[{ label: 'Home', to: '/dashboard' }, { label: 'Automation' }]}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            disabled={Boolean(busy)}
            onClick={() =>
              run(
                'all',
                () => automationService.runAll(),
                (data) =>
                  `Automation finished: ${data.reminders?.created || 0} reminders, ${data.accrual?.created || 0} balance(s) created, ${data.autoAbsent?.marked || 0} absent record(s)`,
              )
            }
          >
            <PlayCircle size={15} /> {busy === 'all' ? 'Running...' : 'Run all jobs'}
          </button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Scheduler</p>
          <div className="mt-2">
            <Badge tone={status.schedulerEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}>
              {status.schedulerEnabled ? 'Running in the background' : 'Disabled by configuration'}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Checks every 15 minutes and runs each job at most once per day. Set DISABLE_AUTOMATION=true to turn the
            scheduler off.
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Timezone</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{status.timezone}</p>
          <p className="mt-2 text-xs text-slate-500">Reminder dates and auto-absent days follow the company timezone.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Email delivery</p>
          <div className="mt-2">
            <Badge tone={status.emailNotifications ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
              {status.emailNotifications ? 'Notifications also emailed' : 'In-app notifications only'}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Email is sent through the SMTP settings already configured for the API. Enable it under Company settings.
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {status.jobs.map((job) => {
          const Icon = JOB_ICONS[job.job] || Sparkles;
          const isBusy = busy === job.job;
          return (
            <Card key={job.job}>
              <CardHeader
                title={job.label}
                description={job.description}
                actions={<Icon size={16} className="text-slate-400" />}
              />
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Badge tone="bg-slate-100 text-slate-600">
                    {job.job === 'auto-absent' && !status.autoAbsentScheduled ? 'Manual only' : job.cadence}
                  </Badge>
                  <span>Last run: {job.lastRunAt ? formatDateTime(job.lastRunAt) : 'never'}</span>
                </div>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{summarize(job.lastSummary)}</p>

                {job.job === 'leave-accrual' ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs font-medium text-slate-600">
                      Leave year
                      <input
                        className="field mt-1 h-9 w-24"
                        type="number"
                        min="2000"
                        max="2100"
                        value={year}
                        onChange={(event) => setYear(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        run(
                          'accrual-preview',
                          () => automationService.initializeLeave({ year: Number(year), dryRun: true }),
                          (data) =>
                            `Preview: ${data.created} balance(s) would be created, ${data.updated} updated`,
                        )
                      }
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        run(
                          job.job,
                          () => automationService.initializeLeave({ year: Number(year) }),
                          (data) => `Leave balances ready for ${data.year}`,
                        )
                      }
                    >
                      {isBusy ? 'Running...' : 'Initialise now'}
                    </button>
                  </div>
                ) : null}

                {job.job === 'reminders' ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      run(
                        job.job,
                        () => automationService.runReminders(),
                        (data) => `${data.created} reminder notification(s) created`,
                      )
                    }
                  >
                    {isBusy ? 'Running...' : 'Send today’s reminders'}
                  </button>
                ) : null}

                {job.job === 'auto-absent' ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        run(
                          'absent-preview',
                          () => automationService.autoAbsent({ dryRun: true }),
                          (data) =>
                            data.workingDay
                              ? `Preview: ${data.wouldMark} record(s) would be marked absent for ${data.date}`
                              : data.reason,
                        )
                      }
                    >
                      Preview yesterday
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        run(
                          job.job,
                          () => automationService.autoAbsent({}),
                          (data) =>
                            data.workingDay
                              ? `${data.marked} record(s) marked absent for ${data.date}`
                              : data.reason,
                        )
                      }
                    >
                      {isBusy ? 'Running...' : 'Mark yesterday absent'}
                    </button>
                  </div>
                ) : null}

                {job.lastError ? (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{job.lastError}</p>
                ) : null}
              </div>
            </Card>
          );
        })}

        <Card>
          <CardHeader
            title="What runs automatically"
            description="No manual triggers needed once the API is running"
            actions={<RefreshCw size={16} className="text-slate-400" />}
          />
          <ul className="space-y-2.5 p-5 text-sm text-slate-600">
            <li>• Birthday, work anniversary and probation confirmation reminders.</li>
            <li>• Document expiry alerts 30 days before the expiry date.</li>
            <li>• One daily digest of pending leave, WFH and attendance corrections.</li>
            <li>• Yearly leave balance creation with carry-forward where configured.</li>
            <li>
              • Absent marking for past working days with no attendance or approved leave — available here, switched off
              for automatic runs unless ENABLE_AUTO_ABSENT=true is set.
            </li>
            <li className="text-xs text-slate-500">
              Every reminder is created once per recipient per event, so repeated runs never duplicate notifications.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default AutomationPage;
