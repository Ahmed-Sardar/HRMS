import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Briefcase, CalendarPlus, LayoutGrid, List, Plus, Star, UserPlus, Users, ArrowRight } from 'lucide-react';
import Avatar from '../../components/ui/Avatar';
import { Stagger, StaggerItem } from '../../components/ui/motion';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import DataTable from '../../components/ui/DataTable';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Select, Textarea, FormGrid } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { recruitmentService } from '../../services/recruitment.service';
import { departmentService, designationService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import { RECRUITMENT_STAGE_LABELS, formatEnum } from '../../utils/constants';
import { formatDate, formatDateTime } from '../../utils/format';
import cn from '../../utils/cn';

const emptyJob = {
  title: '',
  code: '',
  department: '',
  designation: '',
  location: '',
  employmentType: 'FULL_TIME',
  workMode: 'ONSITE',
  openings: 1,
  salaryMin: '',
  salaryMax: '',
  description: '',
  status: 'OPEN',
  closingDate: '',
};

const emptyCandidate = {
  jobOpening: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  currentCompany: '',
  currentDesignation: '',
  totalExperience: '',
  expectedCtc: '',
  source: 'LINKEDIN',
  notes: '',
};

const RecruitmentPage = () => {
  const dispatch = useDispatch();
  const [tab, setTab] = useState('jobs');
  const [jobs, setJobs] = useState({ items: [], pagination: null });
  const [candidates, setCandidates] = useState({ items: [], pagination: null, counts: {} });
  const [interviews, setInterviews] = useState({ items: [], pagination: null });
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [candidateView, setCandidateView] = useState('board');
  const [movingId, setMovingId] = useState('');

  const [jobModal, setJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [jobForm, setJobForm] = useState(emptyJob);
  const [closeJob, setCloseJob] = useState(null);

  const [candidateModal, setCandidateModal] = useState(false);
  const [candidateForm, setCandidateForm] = useState(emptyCandidate);
  const [resume, setResume] = useState(null);
  const [hireModal, setHireModal] = useState(null);
  const [hireForm, setHireForm] = useState({ dateOfJoining: '', department: '', designation: '', employmentType: 'FULL_TIME', role: 'EMPLOYEE' });

  const [interviewModal, setInterviewModal] = useState(false);
  const [interviewForm, setInterviewForm] = useState({ candidate: '', type: 'TECHNICAL', mode: 'VIDEO', scheduledAt: '', durationMinutes: 45, meetingLink: '', location: '' });
  const [feedbackModal, setFeedbackModal] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState({ technical: 3, communication: 3, cultureFit: 3, overall: 3, strengths: '', weaknesses: '', recommendation: 'HIRE' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'jobs') setJobs(await recruitmentService.jobs({ search: search || undefined, limit: 50 }));
      if (tab === 'candidates') setCandidates(await recruitmentService.candidates({ search: search || undefined, stage: stageFilter || undefined, limit: 50 }));
      if (tab === 'interviews') setInterviews(await recruitmentService.interviews({ limit: 50 }));
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, search, stageFilter, tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    departmentService.list({ limit: 100 }).then((res) => setDepartments(res.items || [])).catch(() => {});
    designationService.list({ limit: 100 }).then((res) => setDesignations(res.items || [])).catch(() => {});
  }, []);

  const saveJob = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...jobForm,
        openings: Number(jobForm.openings) || 1,
        salaryMin: jobForm.salaryMin ? Number(jobForm.salaryMin) : undefined,
        salaryMax: jobForm.salaryMax ? Number(jobForm.salaryMax) : undefined,
        department: jobForm.department || undefined,
        designation: jobForm.designation || undefined,
        closingDate: jobForm.closingDate || undefined,
      };
      if (editingJob) await recruitmentService.updateJob(editingJob._id, payload);
      else await recruitmentService.createJob(payload);
      dispatch(toast(editingJob ? 'Job opening updated' : 'Job opening created'));
      setJobModal(false);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const archiveJob = async () => {
    setBusy(true);
    try {
      await recruitmentService.removeJob(closeJob._id);
      dispatch(toast('Job opening closed'));
      setCloseJob(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const addCandidate = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const formData = new FormData();
      Object.entries(candidateForm).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) formData.append(key, value);
      });
      if (resume) formData.append('resume', resume);
      await recruitmentService.createCandidate(formData);
      dispatch(toast('Candidate added'));
      setCandidateModal(false);
      setCandidateForm(emptyCandidate);
      setResume(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const moveStage = async (candidate, stage) => {
    setMovingId(candidate._id);
    try {
      await recruitmentService.moveCandidate(candidate._id, { stage });
      dispatch(toast(`Candidate moved to ${formatEnum(stage)}`));
      await load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setMovingId('');
    }
  };

  const PIPELINE_STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'TECHNICAL', 'HR_ROUND', 'OFFER', 'HIRED'];
  const stageTones = {
    APPLIED: 'from-sky-200 to-aqua-200',
    SCREENING: 'from-aqua-200 to-mint-200',
    INTERVIEW: 'from-mint-200 to-pista-200',
    TECHNICAL: 'from-lavender-200 to-violet-200',
    HR_ROUND: 'from-blush-200 to-blush-300',
    OFFER: 'from-peach-200 to-sun-200',
    HIRED: 'from-mint-300 to-emerald-200',
  };
  const nextStage = (stage) => {
    const index = PIPELINE_STAGES.indexOf(stage);
    if (index < 0 || index >= PIPELINE_STAGES.length - 1) return null;
    return PIPELINE_STAGES[index + 1];
  };

  const hire = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await recruitmentService.hireCandidate(hireModal._id, hireForm);
      dispatch(toast('Candidate converted to employee'));
      setHireModal(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const scheduleInterview = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await recruitmentService.scheduleInterview({
        ...interviewForm,
        durationMinutes: Number(interviewForm.durationMinutes) || 45,
        meetingLink: interviewForm.meetingLink || undefined,
        location: interviewForm.location || undefined,
      });
      dispatch(toast('Interview scheduled'));
      setInterviewModal(false);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const submitFeedback = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...feedbackForm,
        technical: Number(feedbackForm.technical),
        communication: Number(feedbackForm.communication),
        cultureFit: Number(feedbackForm.cultureFit),
        overall: Number(feedbackForm.overall),
        status: 'COMPLETED',
      };
      await recruitmentService.submitFeedback(feedbackModal._id, payload);
      dispatch(toast('Interview feedback saved'));
      setFeedbackModal(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const jobColumns = [
    {
      key: 'title',
      header: 'Opening',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.title}</p>
          <p className="text-xs text-slate-500">
            {row.code} · {row.department?.name || 'No department'} · {formatEnum(row.workMode)}
          </p>
        </div>
      ),
    },
    { key: 'openings', header: 'Openings', render: (row) => row.openings },
    { key: 'applicants', header: 'Applicants', render: (row) => row.applicantCount || 0 },
    { key: 'employmentType', header: 'Type', render: (row) => formatEnum(row.employmentType) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'closingDate', header: 'Closes', render: (row) => (row.closingDate ? formatDate(row.closingDate) : '—') },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setEditingJob(row);
              setJobForm({
                title: row.title,
                code: row.code,
                department: row.department?._id || "",
                designation: row.designation?._id || '',
                location: row.location || '',
                employmentType: row.employmentType || 'FULL_TIME',
                workMode: row.workMode || 'ONSITE',
                openings: row.openings || 1,
                salaryMin: row.salaryMin || '',
                salaryMax: row.salaryMax || '',
                description: row.description || '',
                status: row.status || 'OPEN',
                closingDate: row.closingDate ? new Date(row.closingDate).toISOString().slice(0, 10) : '',
              });
              setJobModal(true);
            }}
          >
            Edit
          </button>
          <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setCloseJob(row)}>
            Close
          </button>
        </div>
      ),
    },
  ];

  const candidateColumns = [
    {
      key: 'name',
      header: 'Candidate',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.firstName} {row.lastName}
          </p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      ),
    },
    { key: 'jobOpening', header: 'Role', render: (row) => row.jobOpening?.title || '—' },
    { key: 'experience', header: 'Experience', render: (row) => `${row.totalExperience || 0} yr` },
    {
      key: 'stage',
      header: 'Stage',
      render: (row) => (
        <select
          className="field h-8 py-0 text-xs"
          value={row.stage}
          onChange={(event) => moveStage(row, event.target.value)}
        >
          {Object.entries(RECRUITMENT_STAGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (row) => (
        <span className="flex items-center gap-1 text-sm">
          <Star size={13} className="text-amber-500" /> {row.rating || 0}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setInterviewForm({ ...interviewForm, candidate: row._id });
              setInterviewModal(true);
            }}
          >
            <CalendarPlus size={13} /> Interview
          </button>
          {row.stage !== 'HIRED' ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setHireModal(row);
                setHireForm({ dateOfJoining: '', department: '', designation: '', employmentType: 'FULL_TIME', role: 'EMPLOYEE' });
              }}
            >
              Hire
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const interviewColumns = [
    {
      key: 'candidate',
      header: 'Candidate',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.candidate?.firstName} {row.candidate?.lastName}
          </p>
          <p className="text-xs text-slate-500">{row.candidate?.jobOpening?.title || '—'}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Round', render: (row) => formatEnum(row.type) },
    { key: 'scheduledAt', header: 'Scheduled', render: (row) => formatDateTime(row.scheduledAt) },
    { key: 'mode', header: 'Mode', render: (row) => formatEnum(row.mode) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'feedback',
      header: 'Feedback',
      render: (row) =>
        row.feedback?.overall ? (
          <span className="text-xs text-slate-600">
            {row.feedback.overall}/5 · {formatEnum(row.feedback.recommendation)}
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setFeedbackModal(row);
              setFeedbackForm({ technical: 3, communication: 3, cultureFit: 3, overall: 3, strengths: '', weaknesses: '', recommendation: 'HIRE' });
            }}
          >
            Add feedback
          </button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Recruitment"
        description="Manage job openings, candidates, interviews and convert hires into employees."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Recruitment' }]}
        actions={
          <>
            {tab === 'jobs' ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setEditingJob(null);
                  setJobForm(emptyJob);
                  setJobModal(true);
                }}
              >
                <Plus size={16} /> New opening
              </button>
            ) : null}
            {tab === 'candidates' ? (
              <button type="button" className="btn btn-primary" onClick={() => setCandidateModal(true)}>
                <UserPlus size={16} /> Add candidate
              </button>
            ) : null}
            {tab === 'interviews' ? (
              <button type="button" className="btn btn-primary" onClick={() => setInterviewModal(true)}>
                <CalendarPlus size={16} /> Schedule interview
              </button>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="px-4 pt-2">
          <Tabs
            items={[
              { key: 'jobs', label: 'Job openings', count: jobs.pagination?.total },
              { key: 'candidates', label: 'Candidates', count: candidates.pagination?.total },
              { key: 'interviews', label: 'Interviews', count: interviews.pagination?.total },
            ]}
            value={tab}
            onChange={(next) => {
              setSearch('');
              setTab(next);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          {tab !== 'interviews' ? (
            <>
              <input className="field w-64" placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
              {tab === 'candidates' ? (
                <Select
                  className="w-48"
                  placeholder="All stages"
                  value={stageFilter}
                  onChange={(event) => setStageFilter(event.target.value)}
                  options={Object.entries(RECRUITMENT_STAGE_LABELS).map(([value, label]) => ({ value, label }))}
                />
              ) : null}
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Briefcase size={15} className="text-slate-400" /> Interview schedule and feedback
            </p>
          )}
          <span className="ml-auto text-sm text-slate-500">
            <Users size={14} className="mr-1 inline" />
            {tab === 'jobs' ? jobs.pagination?.total ?? 0 : tab === 'candidates' ? candidates.pagination?.total ?? 0 : interviews.pagination?.total ?? 0} record(s)
          </span>
          {tab === 'candidates' ? (
            <div className="inline-flex items-center gap-1 rounded-xl border border-white bg-white/75 p-1 shadow-inset backdrop-blur">
              <button
                type="button"
                onClick={() => setCandidateView('board')}
                className={candidateView === 'board' ? 'btn btn-primary btn-sm px-2 py-1' : 'btn btn-ghost btn-sm px-2 py-1'}
                aria-label="Pipeline board"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setCandidateView('table')}
                className={candidateView === 'table' ? 'btn btn-primary btn-sm px-2 py-1' : 'btn btn-ghost btn-sm px-2 py-1'}
                aria-label="Table view"
              >
                <List size={14} />
              </button>
            </div>
          ) : null}
        </div>
        {tab === 'jobs' ? (
          <DataTable columns={jobColumns} rows={jobs.items} loading={loading} emptyTitle="No job openings" emptyDescription="Create an opening to start receiving candidates." />
        ) : tab === 'candidates' ? (
          candidateView === 'table' ? (
            <DataTable columns={candidateColumns} rows={candidates.items} loading={loading} emptyTitle="No candidates" emptyDescription="Add candidates manually or from referrals." />
          ) : (
            <div className="overflow-x-auto p-4">
              <div className="flex min-w-[1080px] gap-3">
                {PIPELINE_STAGES.map((stage) => {
                  const items = candidates.items.filter((candidate) => candidate.stage === stage);
                  return (
                    <div key={stage} className="flex w-[220px] shrink-0 flex-col rounded-2xl border border-white bg-white/55 p-2.5 shadow-inset">
                      <div className={cn('mb-2 rounded-xl bg-gradient-to-r px-2.5 py-1.5', stageTones[stage])}>
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                          <span className="uppercase tracking-[0.08em]">{RECRUITMENT_STAGE_LABELS[stage]}</span>
                          <span className="rounded-full bg-white/80 px-1.5">{items.length}</span>
                        </div>
                      </div>
                      <Stagger className="flex-1 space-y-2">
                        {items.map((candidate) => {
                          const next = nextStage(stage);
                          return (
                            <StaggerItem key={candidate._id}>
                              <div className="rounded-xl border border-white/90 bg-white/85 p-2.5 shadow-inset transition hover:-translate-y-0.5 hover:shadow-glass">
                                <div className="flex items-center gap-2">
                                  <Avatar name={`${candidate.firstName} ${candidate.lastName}`} size="xs" />
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-slate-800">
                                      {candidate.firstName} {candidate.lastName}
                                    </p>
                                    <p className="truncate text-[10px] text-slate-500">
                                      {candidate.jobOpening?.title || 'No role'} · {candidate.totalExperience || 0} yr
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-1">
                                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                    <Star size={10} className="text-amber-500" /> {candidate.rating || 0}
                                  </span>
                                  {next ? (
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm px-1.5 py-1 text-[10px]"
                                      disabled={movingId === candidate._id}
                                      onClick={() => moveStage(candidate, next)}
                                      title={`Move to ${RECRUITMENT_STAGE_LABELS[next]}`}
                                    >
                                      {RECRUITMENT_STAGE_LABELS[next]} <ArrowRight size={10} />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm px-1.5 py-1 text-[10px]"
                                      onClick={() => {
                                        setHireModal(candidate);
                                        setHireForm({ dateOfJoining: '', department: '', designation: '', employmentType: 'FULL_TIME', role: 'EMPLOYEE' });
                                      }}
                                    >
                                      Hire
                                    </button>
                                  )}
                                </div>
                              </div>
                            </StaggerItem>
                          );
                        })}
                        {!items.length ? (
                          <p className="rounded-xl border border-dashed border-white bg-white/40 px-2 py-4 text-center text-[10px] text-slate-400">
                            No candidates
                          </p>
                        ) : null}
                      </Stagger>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <DataTable columns={interviewColumns} rows={interviews.items} loading={loading} emptyTitle="No interviews scheduled" emptyDescription="Schedule an interview from the candidates tab." />
        )}
      </Card>

      <Modal
        open={jobModal}
        onClose={() => setJobModal(false)}
        title={editingJob ? 'Edit job opening' : 'New job opening'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setJobModal(false)}>
              Cancel
            </button>
            <button type="submit" form="job-form" className="btn btn-primary" disabled={busy}>
              Save opening
            </button>
          </>
        }
      >
        <form id="job-form" onSubmit={saveJob}>
          <FormGrid columns={2}>
            <Input label="Job title" required value={jobForm.title} onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })} />
            <Input label="Job code" required value={jobForm.code} onChange={(event) => setJobForm({ ...jobForm, code: event.target.value })} />
            <Select
              label="Department"
              placeholder="Select department"
              value={jobForm.department}
              onChange={(event) => setJobForm({ ...jobForm, department: event.target.value })}
              options={departments.map((item) => ({ value: item._id, label: item.name }))}
            />
            <Select
              label="Designation"
              placeholder="Select designation"
              value={jobForm.designation}
              onChange={(event) => setJobForm({ ...jobForm, designation: event.target.value })}
              options={designations.map((item) => ({ value: item._id, label: item.title }))}
            />
            <Input label="Location" value={jobForm.location} onChange={(event) => setJobForm({ ...jobForm, location: event.target.value })} />
            <Input label="Openings" type="number" min="1" value={jobForm.openings} onChange={(event) => setJobForm({ ...jobForm, openings: event.target.value })} />
            <Select
              label="Employment type"
              value={jobForm.employmentType}
              onChange={(event) => setJobForm({ ...jobForm, employmentType: event.target.value })}
              options={['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT'].map((value) => ({ value, label: formatEnum(value) }))}
            />
            <Select
              label="Work mode"
              value={jobForm.workMode}
              onChange={(event) => setJobForm({ ...jobForm, workMode: event.target.value })}
              options={['ONSITE', 'HYBRID', 'REMOTE'].map((value) => ({ value, label: formatEnum(value) }))}
            />
            <Input label="Salary from" type="number" min="0" value={jobForm.salaryMin} onChange={(event) => setJobForm({ ...jobForm, salaryMin: event.target.value })} />
            <Input label="Salary to" type="number" min="0" value={jobForm.salaryMax} onChange={(event) => setJobForm({ ...jobForm, salaryMax: event.target.value })} />
            <Select
              label="Status"
              value={jobForm.status}
              onChange={(event) => setJobForm({ ...jobForm, status: event.target.value })}
              options={['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'CANCELLED'].map((value) => ({ value, label: formatEnum(value) }))}
            />
            <Input label="Closing date" type="date" value={jobForm.closingDate} onChange={(event) => setJobForm({ ...jobForm, closingDate: event.target.value })} />
          </FormGrid>
          <div className="mt-4">
            <Textarea label="Job description" required rows={5} value={jobForm.description} onChange={(event) => setJobForm({ ...jobForm, description: event.target.value })} />
          </div>
        </form>
      </Modal>

      <Modal
        open={candidateModal}
        onClose={() => setCandidateModal(false)}
        title="Add candidate"
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCandidateModal(false)}>
              Cancel
            </button>
            <button type="submit" form="candidate-form" className="btn btn-primary" disabled={busy}>
              Add candidate
            </button>
          </>
        }
      >
        <form id="candidate-form" onSubmit={addCandidate}>
          <FormGrid columns={2}>
            <Select
              label="Applied for"
              required
              placeholder="Select job opening"
              value={candidateForm.jobOpening}
              onChange={(event) => setCandidateForm({ ...candidateForm, jobOpening: event.target.value })}
              options={jobs.items.map((item) => ({ value: item._id, label: `${item.title} (${item.code})` }))}
            />
            <Input label="First name" required value={candidateForm.firstName} onChange={(event) => setCandidateForm({ ...candidateForm, firstName: event.target.value })} />
            <Input label="Last name" required value={candidateForm.lastName} onChange={(event) => setCandidateForm({ ...candidateForm, lastName: event.target.value })} />
            <Input label="Email" type="email" required value={candidateForm.email} onChange={(event) => setCandidateForm({ ...candidateForm, email: event.target.value })} />
            <Input label="Phone" value={candidateForm.phone} onChange={(event) => setCandidateForm({ ...candidateForm, phone: event.target.value })} />
            <Input label="Current company" value={candidateForm.currentCompany} onChange={(event) => setCandidateForm({ ...candidateForm, currentCompany: event.target.value })} />
            <Input label="Current designation" value={candidateForm.currentDesignation} onChange={(event) => setCandidateForm({ ...candidateForm, currentDesignation: event.target.value })} />
            <Input label="Experience (years)" type="number" min="0" step="0.5" value={candidateForm.totalExperience} onChange={(event) => setCandidateForm({ ...candidateForm, totalExperience: event.target.value })} />
            <Input label="Expected CTC" type="number" min="0" value={candidateForm.expectedCtc} onChange={(event) => setCandidateForm({ ...candidateForm, expectedCtc: event.target.value })} />
            <Select
              label="Source"
              value={candidateForm.source}
              onChange={(event) => setCandidateForm({ ...candidateForm, source: event.target.value })}
              options={['LINKEDIN', 'REFERRAL', 'NAUKRI', 'WEBSITE', 'AGENCY', 'CAMPUS', 'OTHER'].map((value) => ({ value, label: formatEnum(value) }))}
            />
            <div className="flex flex-col">
              <label className="label" htmlFor="resume">
                Resume (PDF / Word)
              </label>
              <input id="resume" type="file" accept=".pdf,.doc,.docx" className="field" onChange={(event) => setResume(event.target.files?.[0] || null)} />
            </div>
          </FormGrid>
          <div className="mt-4">
            <Textarea label="Notes" rows={3} value={candidateForm.notes} onChange={(event) => setCandidateForm({ ...candidateForm, notes: event.target.value })} />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(hireModal)}
        onClose={() => setHireModal(null)}
        title="Convert candidate to employee"
        description={hireModal ? `${hireModal.firstName} ${hireModal.lastName} · ${hireModal.email}` : ''}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setHireModal(null)}>
              Cancel
            </button>
            <button type="submit" form="hire-form" className="btn btn-primary" disabled={busy}>
              Create employee
            </button>
          </>
        }
      >
        <form id="hire-form" onSubmit={hire} className="space-y-4">
          <FormGrid columns={2}>
            <Input label="Date of joining" type="date" required value={hireForm.dateOfJoining} onChange={(event) => setHireForm({ ...hireForm, dateOfJoining: event.target.value })} />
            <Select
              label="Department"
              required
              placeholder="Select department"
              value={hireForm.department}
              onChange={(event) => setHireForm({ ...hireForm, department: event.target.value })}
              options={departments.map((item) => ({ value: item._id, label: item.name }))}
            />
            <Select
              label="Designation"
              placeholder="Select designation"
              value={hireForm.designation}
              onChange={(event) => setHireForm({ ...hireForm, designation: event.target.value })}
              options={designations.map((item) => ({ value: item._id, label: item.title }))}
            />
            <Select
              label="Employment type"
              value={hireForm.employmentType}
              onChange={(event) => setHireForm({ ...hireForm, employmentType: event.target.value })}
              options={['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT'].map((value) => ({ value, label: formatEnum(value) }))}
            />
            <Select
              label="System role"
              value={hireForm.role}
              onChange={(event) => setHireForm({ ...hireForm, role: event.target.value })}
              options={['EMPLOYEE', 'HR', 'FINANCE', 'ADMIN'].map((value) => ({ value, label: formatEnum(value) }))}
            />
          </FormGrid>
          <p className="text-xs text-slate-500">
            A user account is created and a welcome email with temporary credentials is sent to the candidate.
          </p>
        </form>
      </Modal>

      <Modal
        open={interviewModal}
        onClose={() => setInterviewModal(false)}
        title="Schedule interview"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setInterviewModal(false)}>
              Cancel
            </button>
            <button type="submit" form="interview-form" className="btn btn-primary" disabled={busy}>
              Schedule
            </button>
          </>
        }
      >
        <form id="interview-form" onSubmit={scheduleInterview} className="space-y-4">
          <Select
            label="Candidate"
            required
            placeholder="Select candidate"
            value={interviewForm.candidate}
            onChange={(event) => setInterviewForm({ ...interviewForm, candidate: event.target.value })}
            options={candidates.items
              .filter((item) => item.stage !== 'HIRED')
              .map((item) => ({ value: item._id, label: `${item.firstName} ${item.lastName} — ${item.jobOpening?.title || ''}` }))}
          />
          <FormGrid columns={2}>
            <Select
              label="Round"
              value={interviewForm.type}
              onChange={(event) => setInterviewForm({ ...interviewForm, type: event.target.value })}
              options={['SCREENING', 'TECHNICAL', 'MANAGERIAL', 'HR', 'FINAL'].map((value) => ({ value, label: formatEnum(value) }))}
            />
            <Select
              label="Mode"
              value={interviewForm.mode}
              onChange={(event) => setInterviewForm({ ...interviewForm, mode: event.target.value })}
              options={['IN_PERSON', 'VIDEO', 'PHONE'].map((value) => ({ value, label: formatEnum(value) }))}
            />
            <Input label="Scheduled at" type="datetime-local" required value={interviewForm.scheduledAt} onChange={(event) => setInterviewForm({ ...interviewForm, scheduledAt: event.target.value })} />
            <Input label="Duration (minutes)" type="number" min="15" step="15" value={interviewForm.durationMinutes} onChange={(event) => setInterviewForm({ ...interviewForm, durationMinutes: event.target.value })} />
            <Input label="Meeting link" value={interviewForm.meetingLink} onChange={(event) => setInterviewForm({ ...interviewForm, meetingLink: event.target.value })} />
            <Input label="Location" value={interviewForm.location} onChange={(event) => setInterviewForm({ ...interviewForm, location: event.target.value })} />
          </FormGrid>
        </form>
      </Modal>

      <Modal
        open={Boolean(feedbackModal)}
        onClose={() => setFeedbackModal(null)}
        title="Interview feedback"
        description={feedbackModal ? `${feedbackModal.candidate?.firstName} ${feedbackModal.candidate?.lastName} · ${formatEnum(feedbackModal.type)}` : ''}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setFeedbackModal(null)}>
              Cancel
            </button>
            <button type="submit" form="feedback-form" className="btn btn-primary" disabled={busy}>
              Save feedback
            </button>
          </>
        }
      >
        <form id="feedback-form" onSubmit={submitFeedback} className="space-y-4">
          <FormGrid columns={2}>
            {[
              ['technical', 'Technical'],
              ['communication', 'Communication'],
              ['cultureFit', 'Culture fit'],
              ['overall', 'Overall'],
            ].map(([key, label]) => (
              <Input
                key={key}
                label={`${label} (0-5)`}
                type="number"
                min="0"
                max="5"
                step="0.5"
                value={feedbackForm[key]}
                onChange={(event) => setFeedbackForm({ ...feedbackForm, [key]: event.target.value })}
              />
            ))}
            <Select
              label="Recommendation"
              value={feedbackForm.recommendation}
              onChange={(event) => setFeedbackForm({ ...feedbackForm, recommendation: event.target.value })}
              options={['STRONG_HIRE', 'HIRE', 'HOLD', 'NO_HIRE'].map((value) => ({ value, label: formatEnum(value) }))}
            />
          </FormGrid>
          <Textarea label="Strengths" rows={2} value={feedbackForm.strengths} onChange={(event) => setFeedbackForm({ ...feedbackForm, strengths: event.target.value })} />
          <Textarea label="Concerns" rows={2} value={feedbackForm.weaknesses} onChange={(event) => setFeedbackForm({ ...feedbackForm, weaknesses: event.target.value })} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(closeJob)}
        onClose={() => setCloseJob(null)}
        onConfirm={archiveJob}
        title="Close job opening"
        message={`Close '${closeJob?.title || ''}'? The opening will be archived and no longer accept candidates.`}
        confirmLabel="Close opening"
        variant="danger"
        loading={busy}
      />
    </div>
  );
};

export default RecruitmentPage;
