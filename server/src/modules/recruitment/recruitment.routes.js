const express = require('express');
const { z } = require('zod');
const JobOpening = require('../../models/JobOpening');
const Candidate = require('../../models/Candidate');
const Interview = require('../../models/Interview');
const Employee = require('../../models/Employee');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { uploadResume, toStoredFile } = require('../../middleware/upload');
const { logAudit } = require('../../utils/audit');
const { getPagination, paginatedResponse } = require('../../utils/pagination');
const { ROLES, RECRUITMENT_STAGE, ROLE_VALUES } = require('../../config/constants');
const { createEmployee } = require('../employees/employee.service');
const { notifyRoles } = require('../../services/notification.service');
const time = require('../../utils/time');

const router = express.Router();
router.use(protect);

const recruiterRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR];

// ---------------- Job openings ----------------
const jobBody = z.object({
  title: z.string().min(2).max(160),
  code: z.string().min(2).max(30),
  department: z.string().optional(),
  designation: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT']).optional(),
  workMode: z.enum(['ONSITE', 'HYBRID', 'REMOTE']).optional(),
  experienceMin: z.coerce.number().min(0).optional(),
  experienceMax: z.coerce.number().min(0).optional(),
  salaryMin: z.coerce.number().min(0).optional(),
  salaryMax: z.coerce.number().min(0).optional(),
  openings: z.coerce.number().min(1).optional(),
  description: z.string().min(10),
  responsibilities: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  status: z.enum(['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'CANCELLED']).optional(),
  hiringManager: z.string().optional(),
  closingDate: z.coerce.date().optional(),
});

router.get('/jobs', authorize(...recruiterRoles), asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query);
  const filter = { isDeleted: false };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.department) filter.department = req.query.department;
  if (req.query.search) {
    filter.$or = [
      { title: { $regex: req.query.search, $options: 'i' } },
      { code: { $regex: req.query.search, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    JobOpening.find(filter)
      .populate('department', 'name')
      .populate('designation', 'title')
      .populate('hiringManager', 'firstName lastName')
      .sort({ postedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    JobOpening.countDocuments(filter),
  ]);
  const counts = await Candidate.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: '$jobOpening', count: { $sum: 1 } } }]);
  const countMap = counts.reduce((acc, item) => ({ ...acc, [String(item._id)]: item.count }), {});
  res.json({
    success: true,
    data: paginatedResponse(items.map((item) => ({ ...item, applicantCount: countMap[String(item._id)] || 0 })), total, pagination),
  });
}));

router.post('/jobs', authorize(...recruiterRoles), validate({ body: jobBody }), asyncHandler(async (req, res) => {
  const payload = { ...req.body, code: req.body.code.toUpperCase(), postedBy: req.user._id };
  const exists = await JobOpening.findOne({ code: payload.code });
  if (exists) throw ApiError.conflict('A job opening with this code already exists');
  const job = await JobOpening.create(payload);
  await logAudit({
    req,
    actor: req.user,
    action: 'JOB_OPENING_CREATED',
    module: 'RECRUITMENT',
    entityType: 'JobOpening',
    entityId: job._id,
    description: `Created job opening ${job.title} (${job.code})`,
    newValue: payload,
  });
  res.status(201).json({ success: true, message: 'Job opening created', data: job });
}));

router.patch('/jobs/:id', authorize(...recruiterRoles), validate({ body: jobBody.partial() }), asyncHandler(async (req, res) => {
  const job = await JobOpening.findOne({ _id: req.params.id, isDeleted: false });
  if (!job) throw ApiError.notFound('Job opening not found');
  const previous = job.toObject();
  Object.assign(job, req.body);
  if (req.body.code) job.code = req.body.code.toUpperCase();
  await job.save();
  await logAudit({
    req,
    actor: req.user,
    action: 'JOB_OPENING_UPDATED',
    module: 'RECRUITMENT',
    entityType: 'JobOpening',
    entityId: job._id,
    description: `Updated job opening ${job.title}`,
    previousValue: { status: previous.status, openings: previous.openings },
    newValue: req.body,
  });
  res.json({ success: true, message: 'Job opening updated', data: job });
}));

router.delete('/jobs/:id', authorize(...recruiterRoles), asyncHandler(async (req, res) => {
  const job = await JobOpening.findByIdAndUpdate(req.params.id, { isDeleted: true, status: 'CLOSED' }, { new: true });
  if (!job) throw ApiError.notFound('Job opening not found');
  await logAudit({
    req,
    actor: req.user,
    action: 'JOB_OPENING_CLOSED',
    module: 'RECRUITMENT',
    entityType: 'JobOpening',
    entityId: job._id,
    description: `Closed job opening ${job.title}`,
  });
  res.json({ success: true, message: 'Job opening closed' });
}));

// ---------------- Candidates ----------------
const candidateBody = z.object({
  jobOpening: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  currentCompany: z.string().optional(),
  currentDesignation: z.string().optional(),
  totalExperience: z.coerce.number().min(0).optional(),
  currentCtc: z.coerce.number().min(0).optional(),
  expectedCtc: z.coerce.number().min(0).optional(),
  noticePeriodDays: z.coerce.number().min(0).optional(),
  location: z.string().optional(),
  skills: z.array(z.string()).optional(),
  source: z.enum(['LINKEDIN', 'REFERRAL', 'NAUKRI', 'WEBSITE', 'AGENCY', 'CAMPUS', 'OTHER']).optional(),
  portfolioUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  notes: z.string().max(4000).optional(),
});

router.get('/candidates', authorize(...recruiterRoles), asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query);
  const filter = { isDeleted: false };
  if (req.query.jobOpening) filter.jobOpening = req.query.jobOpening;
  if (req.query.stage) filter.stage = req.query.stage;
  if (req.query.search) {
    filter.$or = [
      { firstName: { $regex: req.query.search, $options: 'i' } },
      { lastName: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    Candidate.find(filter)
      .populate('jobOpening', 'title code department')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean({ virtuals: true }),
    Candidate.countDocuments(filter),
  ]);
  const counts = await Candidate.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: '$stage', count: { $sum: 1 } } },
  ]);
  res.json({
    success: true,
    data: {
      ...paginatedResponse(items, total, pagination),
      counts: counts.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
    },
  });
}));

router.post(
  '/candidates',
  authorize(...recruiterRoles),
  uploadResume.single('resume'),
  validate({ body: candidateBody }),
  asyncHandler(async (req, res) => {
    const job = await JobOpening.findOne({ _id: req.body.jobOpening, isDeleted: false });
    if (!job) throw ApiError.notFound('Job opening not found');
    const duplicate = await Candidate.findOne({ jobOpening: job._id, email: req.body.email.toLowerCase(), isDeleted: false });
    if (duplicate) throw ApiError.conflict('A candidate with this email already applied for this role');

    const candidate = await Candidate.create({
      ...req.body,
      resume: req.file ? toStoredFile(req.file, 'resumes') : undefined,
      stage: RECRUITMENT_STAGE.APPLIED,
      stageHistory: [{ stage: RECRUITMENT_STAGE.APPLIED, at: new Date(), by: req.user._id }],
      createdBy: req.user._id,
    });

    await logAudit({
      req,
      actor: req.user,
      action: 'CANDIDATE_CREATED',
      module: 'RECRUITMENT',
      entityType: 'Candidate',
      entityId: candidate._id,
      description: `Added candidate ${candidate.firstName} ${candidate.lastName} for ${job.title}`,
    });

    res.status(201).json({ success: true, message: 'Candidate added', data: candidate });
  }),
);

router.patch(
  '/candidates/:id/stage',
  authorize(...recruiterRoles),
  validate({
    body: z.object({
      stage: z.enum(Object.values(RECRUITMENT_STAGE)),
      comment: z.string().max(1000).optional(),
      rejectionReason: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const candidate = await Candidate.findOne({ _id: req.params.id, isDeleted: false });
    if (!candidate) throw ApiError.notFound('Candidate not found');
    const previousStage = candidate.stage;
    candidate.stage = req.body.stage;
    if (req.body.rejectionReason) candidate.rejectionReason = req.body.rejectionReason;
    candidate.stageHistory.push({ stage: req.body.stage, at: new Date(), by: req.user._id, comment: req.body.comment });
    await candidate.save();

    await logAudit({
      req,
      actor: req.user,
      action: 'CANDIDATE_STAGE_CHANGED',
      module: 'RECRUITMENT',
      entityType: 'Candidate',
      entityId: candidate._id,
      description: `Candidate ${candidate.firstName} ${candidate.lastName} moved from ${previousStage} to ${candidate.stage}`,
      previousValue: { stage: previousStage },
      newValue: { stage: candidate.stage },
    });

    res.json({ success: true, message: 'Candidate stage updated', data: candidate });
  }),
);

router.patch(
  '/candidates/:id',
  authorize(...recruiterRoles),
  validate({
    body: candidateBody.partial().omit({ jobOpening: true }).extend({
      rating: z.coerce.number().min(0).max(5).optional(),
      offeredCtc: z.coerce.number().min(0).optional(),
      offerDate: z.coerce.date().optional(),
      joiningDate: z.coerce.date().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const candidate = await Candidate.findOne({ _id: req.params.id, isDeleted: false });
    if (!candidate) throw ApiError.notFound('Candidate not found');
    Object.assign(candidate, req.body);
    await candidate.save();
    res.json({ success: true, message: 'Candidate updated', data: candidate });
  }),
);

router.post(
  '/candidates/:id/hire',
  authorize(...recruiterRoles),
  validate({
    body: z.object({
      dateOfJoining: z.coerce.date(),
      department: z.string().min(1),
      designation: z.string().optional(),
      employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT']).optional(),
      workLocation: z.string().optional(),
      reportingManager: z.string().optional(),
      role: z.enum(ROLE_VALUES).optional(),
      phone: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const candidate = await Candidate.findOne({ _id: req.params.id, isDeleted: false }).populate('jobOpening', 'title');
    if (!candidate) throw ApiError.notFound('Candidate not found');
    if (candidate.employee) throw ApiError.conflict('This candidate has already been converted to an employee');

    const existingEmployee = await Employee.findOne({ email: candidate.email.toLowerCase(), isDeleted: false });
    if (existingEmployee) throw ApiError.conflict('An employee with this email already exists');

    const result = await createEmployee({
      payload: {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        phone: req.body.phone || candidate.phone,
        department: req.body.department,
        designation: req.body.designation,
        reportingManager: req.body.reportingManager,
        dateOfJoining: req.body.dateOfJoining,
        employmentType: req.body.employmentType || 'FULL_TIME',
        workLocation: req.body.workLocation,
        employmentStatus: 'PROBATION',
        role: req.body.role || ROLES.EMPLOYEE,
        sendWelcomeEmail: true,
      },
      actor: req.user,
      req,
    });

    candidate.employee = result.employee._id;
    candidate.stage = RECRUITMENT_STAGE.HIRED;
    candidate.joiningDate = req.body.dateOfJoining;
    candidate.stageHistory.push({ stage: RECRUITMENT_STAGE.HIRED, at: new Date(), by: req.user._id, comment: 'Converted to employee' });
    await candidate.save();

    await notifyRoles(['HR', 'ADMIN'], {
      title: 'Candidate onboarded',
      message: `${candidate.firstName} ${candidate.lastName} was converted to employee ${result.employee.employeeId}.`,
      type: 'HR',
      link: `/employees/${result.employee._id}`,
    });

    await logAudit({
      req,
      actor: req.user,
      action: 'CANDIDATE_HIRED',
      module: 'RECRUITMENT',
      entityType: 'Candidate',
      entityId: candidate._id,
      description: `Hired candidate ${candidate.firstName} ${candidate.lastName} as ${result.employee.employeeId}`,
      newValue: { employeeId: result.employee.employeeId },
    });

    res.status(201).json({ success: true, message: 'Candidate converted to employee', data: result });
  }),
);

router.delete('/candidates/:id', authorize(...recruiterRoles), asyncHandler(async (req, res) => {
  const candidate = await Candidate.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
  if (!candidate) throw ApiError.notFound('Candidate not found');
  await logAudit({
    req,
    actor: req.user,
    action: 'CANDIDATE_REMOVED',
    module: 'RECRUITMENT',
    entityType: 'Candidate',
    entityId: candidate._id,
    description: `Removed candidate ${candidate.firstName} ${candidate.lastName}`,
  });
  res.json({ success: true, message: 'Candidate removed' });
}));

// ---------------- Interviews ----------------
router.get('/interviews', authorize(...recruiterRoles), asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query);
  const filter = {};
  if (req.query.candidate) filter.candidate = req.query.candidate;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    filter.scheduledAt = {};
    if (req.query.from) filter.scheduledAt.$gte = time.startOfDay(req.query.from);
    if (req.query.to) filter.scheduledAt.$lte = time.endOfDay(req.query.to);
  }
  const [items, total] = await Promise.all([
    Interview.find(filter)
      .populate({ path: 'candidate', select: 'firstName lastName email stage jobOpening', populate: { path: 'jobOpening', select: 'title code' } })
      .populate('interviewers', 'firstName lastName')
      .sort({ scheduledAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Interview.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, pagination) });
}));

router.post(
  '/interviews',
  authorize(...recruiterRoles),
  validate({
    body: z.object({
      candidate: z.string().min(1),
      round: z.coerce.number().min(1).optional(),
      type: z.enum(['SCREENING', 'TECHNICAL', 'MANAGERIAL', 'HR', 'FINAL']).optional(),
      mode: z.enum(['IN_PERSON', 'VIDEO', 'PHONE']).optional(),
      scheduledAt: z.coerce.date(),
      durationMinutes: z.coerce.number().min(15).optional(),
      location: z.string().optional(),
      meetingLink: z.string().optional(),
      interviewers: z.array(z.string()).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const candidate = await Candidate.findOne({ _id: req.body.candidate, isDeleted: false });
    if (!candidate) throw ApiError.notFound('Candidate not found');
    const conflict = await Interview.findOne({
      candidate: candidate._id,
      status: 'SCHEDULED',
      scheduledAt: req.body.scheduledAt,
    });
    if (conflict) throw ApiError.conflict('An interview is already scheduled at this time for the candidate');

    const interview = await Interview.create({ ...req.body, jobOpening: candidate.jobOpening, createdBy: req.user._id });
    candidate.stage = RECRUITMENT_STAGE.INTERVIEW;
    candidate.stageHistory.push({ stage: RECRUITMENT_STAGE.INTERVIEW, at: new Date(), by: req.user._id, comment: 'Interview scheduled' });
    await candidate.save();

    await logAudit({
      req,
      actor: req.user,
      action: 'INTERVIEW_SCHEDULED',
      module: 'RECRUITMENT',
      entityType: 'Interview',
      entityId: interview._id,
      description: `Scheduled ${interview.type} interview for ${candidate.firstName} ${candidate.lastName}`,
      newValue: { scheduledAt: interview.scheduledAt, mode: interview.mode },
    });

    res.status(201).json({ success: true, message: 'Interview scheduled', data: interview });
  }),
);

router.patch(
  '/interviews/:id/feedback',
  authorize(...recruiterRoles),
  validate({
    body: z.object({
      technical: z.coerce.number().min(0).max(5),
      communication: z.coerce.number().min(0).max(5),
      cultureFit: z.coerce.number().min(0).max(5),
      overall: z.coerce.number().min(0).max(5),
      strengths: z.string().max(2000).optional(),
      weaknesses: z.string().max(2000).optional(),
      comments: z.string().max(4000).optional(),
      recommendation: z.enum(['STRONG_HIRE', 'HIRE', 'HOLD', 'NO_HIRE']).optional(),
      status: z.enum(['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED']).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const interview = await Interview.findById(req.params.id).populate('candidate', 'firstName lastName');
    if (!interview) throw ApiError.notFound('Interview not found');
    interview.feedback = {
      ...interview.feedback,
      ...req.body,
      submittedBy: req.user._id,
      submittedAt: new Date(),
    };
    interview.status = req.body.status || 'COMPLETED';
    await interview.save();

    await logAudit({
      req,
      actor: req.user,
      action: 'INTERVIEW_FEEDBACK_SUBMITTED',
      module: 'RECRUITMENT',
      entityType: 'Interview',
      entityId: interview._id,
      description: `Interview feedback submitted for ${interview.candidate?.firstName || 'candidate'}`,
      newValue: interview.feedback,
    });

    res.json({ success: true, message: 'Interview feedback saved', data: interview });
  }),
);

module.exports = router;
