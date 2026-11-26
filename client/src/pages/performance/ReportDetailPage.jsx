import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Pencil,
  Send,
  Trash2,
  Upload,
  XCircle,
  History,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Loader';
import Modal from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Field';
import Alert from '../../components/ui/Alert';
import { toast } from '../../store/uiSlice';
import useAuth from '../../hooks/useAuth';
import { performanceService, financeService, hrService } from '../../services/performance.service';
import { getErrorMessage } from '../../services/api';
import { REPORT_STATUS_LABELS, ROLES, formatEnum } from '../../utils/constants';
import { formatDate, formatDateTime, minutesToDuration, fileSize } from '../../utils/format';

const FINANCE_ACTIONS = [
  { action: 'START_FINANCE_REVIEW', label: 'Start review', tone: 'secondary' },
  { action: 'FINANCE_APPROVE', label: 'Approve', tone: 'primary' },
  { action: 'FINANCE_REQUEST_CORRECTION', label: 'Request correction', tone: 'secondary' },
  { action: 'FINANCE_REJECT', label: 'Reject', tone: 'danger' },
  { action: 'FORWARD_TO_HR', label: 'Forward to HR', tone: 'primary' },
];

const HR_ACTIONS = [
  { action: 'START_HR_REVIEW', label: 'Start review', tone: 'secondary' },
  { action: 'HR_APPROVE', label: 'Approve', tone: 'primary' },
  { action: 'HR_REQUEST_INFO', label: 'Request information', tone: 'secondary' },
  { action: 'HR_REJECT', label: 'Reject', tone: 'danger' },
  { action: 'FORWARD_TO_MANAGER', label: 'Forward to manager', tone: 'secondary' },
  { action: 'COMPLETE', label: 'Mark completed', tone: 'primary' },
];

const actionLabel = (action) =>
  action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

const ReportDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { role, hasRole, employeeProfile } = useAuth();
  const fileRef = useRef(null);

  const [data, setData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [comments, setComments] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ managerFeedback: '', overallRating: 3 });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reportData, previewData] = await Promise.all([
        performanceService.get(id),
        performanceService.preview(id).catch(() => null),
      ]);
      setData(reportData);
      setPreview(previewData);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, id]);

  useEffect(() => {
    load();
  }, [load]);

  const report = data?.report;
  const history = data?.history || [];
  const ownerId = report?.employee?._id || report?.employee?.id || report?.employee;
  const profileId = employeeProfile?.id || employeeProfile?._id;
  const isOwner = Boolean(ownerId && profileId && String(ownerId) === String(profileId));
  const canEdit = isOwner && ['DRAFT', 'CORRECTION_REQUESTED'].includes(report?.status);
  const isFinance = hasRole(ROLES.FINANCE, ROLES.SUPER_ADMIN);
  const isHr = hasRole(ROLES.HR, ROLES.SUPER_ADMIN);

  const financeActions = FINANCE_ACTIONS.filter((item) => {
    if (!isFinance || report?.status === undefined) return false;
    if (report.status === 'FINANCE_APPROVED') return item.action === 'FORWARD_TO_HR';
    if (['SUBMITTED', 'UNDER_FINANCE_REVIEW'].includes(report.status)) return item.action !== 'FORWARD_TO_HR';
    return false;
  });

  const hrActions = HR_ACTIONS.filter((item) => {
    if (!isHr || !report) return false;
    const s = report.status;
    if (['FORWARDED_TO_HR', 'UNDER_HR_REVIEW'].includes(s)) return !['COMPLETE'].includes(item.action);
    if (s === 'HR_APPROVED') return ['COMPLETE', 'FORWARD_TO_MANAGER'].includes(item.action);
    return false;
  });

  const submitReport = async () => {
    setBusy(true);
    try {
      await performanceService.submit(report._id);
      dispatch(toast('Report submitted to Finance'));
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const runAction = async () => {
    setBusy(true);
    try {
      const payload = { action: actionModal.action, comments: comments || undefined };
      if (['FORWARD_TO_HR', 'FINANCE_APPROVE', 'FINANCE_REJECT', 'FINANCE_REQUEST_CORRECTION', 'START_FINANCE_REVIEW'].includes(actionModal.action)) {
        await financeService.review(report._id, payload);
      } else {
        await hrService.review(report._id, payload);
      }
      dispatch(toast(`${actionLabel(actionModal.action)} completed`));
      setActionModal(null);
      setComments('');
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const exportAs = async (format) => {
    try {
      await performanceService.export(report._id, format);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const saveManagerFeedback = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await hrService.managerFeedback(report._id, {
        managerFeedback: feedbackForm.managerFeedback,
        overallRating: Number(feedbackForm.overallRating) || 0,
      });
      dispatch(toast('Manager feedback saved'));
      setFeedbackOpen(false);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const uploadAttachment = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      await performanceService.uploadAttachment(report._id, file);
      dispatch(toast('Attachment uploaded'));
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAttachment = async (attachmentId) => {
    try {
      await performanceService.deleteAttachment(report._id, attachmentId);
      dispatch(toast('Attachment removed'));
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  if (loading) return <PageLoader label="Loading report..." />;
  if (!report) return <Alert tone="error">Report not found or you do not have access.</Alert>;

  const attendance = preview?.attendanceSummary;
  const leave = preview?.leaveSummary;

  return (
    <div>
      <PageHeader
        title={report.title}
        description={`${formatEnum(report.periodType)} · ${formatDate(report.periodStart)} - ${formatDate(report.periodEnd)}`}
        breadcrumb={[{ label: 'Performance reports', to: '/performance/reports' }, { label: 'Report' }]}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/performance/reports')}>
              <ArrowLeft size={15} /> Back
            </button>
            {canEdit ? (
              <Link to={`/performance/reports/${report._id}/edit`} className="btn btn-secondary">
                <Pencil size={15} /> Edit
              </Link>
            ) : null}
            {canEdit ? (
              <button type="button" className="btn btn-primary" onClick={submitReport} disabled={busy}>
                <Send size={15} /> Submit to Finance
              </button>
            ) : null}
            <button type="button" className="btn btn-secondary" onClick={() => exportAs('xlsx')}>
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => exportAs('csv')}>
              <Download size={15} /> CSV
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => exportAs('pdf')}>
              <FileText size={15} /> PDF
            </button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={report.status} labels={REPORT_STATUS_LABELS} />
                <span className="chip bg-slate-100 text-slate-600">Rating {report.overallRating || 0} / 5</span>
                {report.submittedAt ? (
                  <span className="text-xs text-slate-500">Submitted {formatDateTime(report.submittedAt)}</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-medium text-slate-800">{report.employee?.firstName} {report.employee?.lastName}</span> ·{' '}
                {report.employee?.employeeId} · {report.employee?.department?.name || '—'} ·{' '}
                {report.employee?.designation?.title || '—'}
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Manager: {report.reportingManager ? `${report.reportingManager.firstName} ${report.reportingManager.lastName}` : '—'}</p>
              <p>Goals: {report.goals?.length || 0} · KPIs: {report.kpis?.length || 0}</p>
            </div>
          </div>
          <div className="grid gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-3">
            <div>
              <p className="stat-label">Days present</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{attendance?.present ?? 0}</p>
            </div>
            <div>
              <p className="stat-label">Late marks</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{attendance?.late ?? 0}</p>
            </div>
            <div>
              <p className="stat-label">Approved leave</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{leave?.totalDays ?? 0} day(s)</p>
            </div>
            <div>
              <p className="stat-label">Effective hours</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{minutesToDuration(attendance?.effectiveMinutes || 0)}</p>
            </div>
            <div>
              <p className="stat-label">Overtime</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{minutesToDuration(attendance?.overtimeMinutes || 0)}</p>
            </div>
            <div>
              <p className="stat-label">Half days</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{attendance?.halfDays ?? 0}</p>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Self assessment</h3>
              <p className="whitespace-pre-line text-sm text-slate-600">{report.selfAssessment || 'Not provided.'}</p>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Goals & objectives</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Goal</th>
                      <th>Weight</th>
                      <th>Target</th>
                      <th>Achievement</th>
                      <th>Rating</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.goals || []).map((goal) => (
                      <tr key={goal._id}>
                        <td>
                          <p className="font-medium text-slate-800">{goal.title}</p>
                          {goal.description ? <p className="text-xs text-slate-500">{goal.description}</p> : null}
                        </td>
                        <td>{goal.weight || 0}%</td>
                        <td>{goal.target || '—'}</td>
                        <td>{goal.achievement || '—'}</td>
                        <td>{goal.rating || 0}</td>
                        <td className="text-xs">{formatEnum(goal.status)}</td>
                      </tr>
                    ))}
                    {!(report.goals || []).length ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-sm text-slate-500">
                          No goals recorded.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            {(report.kpis || []).length ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">KPIs</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {report.kpis.map((kpi) => (
                    <div key={kpi._id} className="rounded-lg border border-slate-200 px-3 py-2">
                      <p className="text-sm font-medium text-slate-800">{kpi.name}</p>
                      <p className="text-xs text-slate-500">
                        Target {kpi.target || '—'} · Achieved {kpi.achieved || '—'} · Score {kpi.score || 0}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {(report.tasksCompleted || []).length ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Tasks completed</h3>
                <div className="space-y-1.5">
                  {report.tasksCompleted.map((task) => (
                    <div key={task._id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <span className="text-slate-700">{task.title}</span>
                      <span className="text-xs text-slate-500">
                        {formatEnum(task.priority)} · {task.completionDate ? formatDate(task.completionDate) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {[
              ['Achievements', report.achievements],
              ['Project contributions', report.projectContributions],
              ['Challenges', report.challenges],
              ['Skills development', report.skillsDevelopment],
              ['Employee comments', report.employeeComments],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <section key={label}>
                  <h3 className="mb-1 text-sm font-semibold text-slate-800">{label}</h3>
                  <p className="whitespace-pre-line text-sm text-slate-600">{value}</p>
                </section>
              ))}

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Finance comments</p>
                <p className="mt-1 text-sm text-slate-700">{report.financeComments || 'No comments yet.'}</p>
                {report.financeReviewedBy ? (
                  <p className="mt-1 text-xs text-slate-400">— {report.financeReviewedBy.name}</p>
                ) : null}
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">HR / manager feedback</p>
                <p className="mt-1 text-sm text-slate-700">{report.hrComments || 'No comments yet.'}</p>
                {report.managerFeedback ? (
                  <p className="mt-1 text-sm text-slate-600 italic">Manager: {report.managerFeedback}</p>
                ) : null}
              </div>
            </section>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Attachments" description="Excel or CSV files submitted with the report" />
            <div className="divide-y divide-slate-100">
              {(report.attachments || []).length ? (
                report.attachments.map((attachment) => (
                  <div key={attachment._id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{attachment.originalName}</p>
                      <p className="text-xs text-slate-500">
                        {fileSize(attachment.size)} · {formatDate(attachment.uploadedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={async () => {
                          try {
                            await performanceService.downloadAttachment(report._id, attachment._id);
                          } catch (error) {
                            dispatch(toast(getErrorMessage(error), 'error'));
                          }
                        }}
                      >
                        <Download size={14} />
                      </button>
                      {isOwner && ['DRAFT', 'CORRECTION_REQUESTED', 'SUBMITTED'].includes(report.status) ? (
                        <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => removeAttachment(attachment._id)}>
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="px-4 py-5 text-sm text-slate-500">No attachments uploaded.</p>
              )}
            </div>
            {isOwner && !['COMPLETED', 'HR_APPROVED'].includes(report.status) ? (
              <div className="border-t border-slate-100 px-4 py-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  className="hidden"
                  onChange={(event) => uploadAttachment(event.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm w-full"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload Excel or CSV'}
                </button>
              </div>
            ) : null}
          </Card>

          {(financeActions.length > 0 || hrActions.length > 0) && (
            <Card>
              <CardHeader
                title={financeActions.length ? 'Finance decision' : 'HR decision'}
                description="All transitions are validated and recorded in the approval history"
              />
              <div className="flex flex-wrap gap-2 p-4">
                {[...financeActions, ...hrActions].map((item) => (
                  <button
                    key={item.action}
                    type="button"
                    className={
                      item.tone === 'primary'
                        ? 'btn btn-primary btn-sm'
                        : item.tone === 'danger'
                          ? 'btn btn-danger btn-sm'
                          : 'btn btn-secondary btn-sm'
                    }
                    onClick={() => {
                      setActionModal(item);
                      setComments('');
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {isHr && ['FORWARDED_TO_HR', 'UNDER_HR_REVIEW', 'HR_APPROVED'].includes(report.status) ? (
                <div className="px-4 pb-3">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm w-full"
                    onClick={() => {
                      setFeedbackForm({ managerFeedback: report.managerFeedback || '', overallRating: report.overallRating || 3 });
                      setFeedbackOpen(true);
                    }}
                  >
                    Add manager feedback
                  </button>
                </div>
              ) : null}
              <p className="px-4 pb-3 text-xs text-slate-500">
                Signed in as {role}. Self-approval is blocked by the API.
              </p>
            </Card>
          )}

          <Card>
            <CardHeader title="Approval history" description={`${history.length} recorded action(s)`} />
            <div className="max-h-96 overflow-y-auto px-4 py-3">
              {history.length ? (
                <ol className="relative space-y-4 border-l border-slate-200 pl-4">
                  {history.map((entry) => (
                    <li key={entry._id} className="relative">
                      <span className="absolute -left-[21px] top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-navy-700" />
                      <p className="text-sm font-medium text-slate-800">{actionLabel(entry.action)}</p>
                      <p className="text-xs text-slate-500">
                        {entry.actorName} · {entry.actorRole} · {formatDateTime(entry.createdAt)}
                      </p>
                      {entry.comments ? <p className="mt-1 text-xs italic text-slate-600">“{entry.comments}”</p> : null}
                      {entry.newStatus ? (
                        <p className="mt-1 text-[11px] text-slate-400">
                          {entry.previousStatus ? `${entry.previousStatus} → ` : ''}
                          {entry.newStatus}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">No approval actions recorded yet.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Workflow reference" description="Status transitions" />
            <div className="p-4 text-xs text-slate-500">
              <p className="flex items-center gap-1.5">
                <Clock size={12} /> Draft → Submitted → Finance review → Forwarded to HR → Completed
              </p>
              <p className="mt-2 flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-600" /> Finance and HR approvals are separated by role.
              </p>
              <p className="mt-2 flex items-center gap-1.5">
                <XCircle size={12} className="text-red-600" /> Rejections and correction requests require comments.
              </p>
              <p className="mt-2 flex items-center gap-1.5">
                <History size={12} /> Every transition is immutable in the approval history.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title="Manager feedback"
        description={report.title}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setFeedbackOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="manager-feedback-form" className="btn btn-primary" disabled={busy}>
              Save feedback
            </button>
          </>
        }
      >
        <form id="manager-feedback-form" onSubmit={saveManagerFeedback} className="space-y-4">
          <Textarea
            label="Feedback"
            rows={5}
            required
            value={feedbackForm.managerFeedback}
            onChange={(event) => setFeedbackForm({ ...feedbackForm, managerFeedback: event.target.value })}
          />
          <div className="flex flex-col">
            <label className="label" htmlFor="overall-rating">
              Overall rating (0-5)
            </label>
            <input
              id="overall-rating"
              className="field"
              type="number"
              min="0"
              max="5"
              step="0.5"
              value={feedbackForm.overallRating}
              onChange={(event) => setFeedbackForm({ ...feedbackForm, overallRating: event.target.value })}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(actionModal)}
        onClose={() => setActionModal(null)}
        title={actionModal ? actionLabel(actionModal.action) : ''}
        description={report.title}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setActionModal(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={runAction} disabled={busy}>
              Confirm
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Textarea
            label="Comments"
            rows={4}
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            placeholder="Add verification notes or feedback"
          />
          {['FINANCE_REJECT', 'FINANCE_REQUEST_CORRECTION', 'HR_REJECT', 'HR_REQUEST_INFO'].includes(actionModal?.action) ? (
            <Alert tone="warning">A comment is mandatory for this action.</Alert>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

export default ReportDetailPage;
