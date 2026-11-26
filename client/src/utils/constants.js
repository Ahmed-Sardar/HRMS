export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  HR: 'HR',
  FINANCE: 'FINANCE',
  EMPLOYEE: 'EMPLOYEE',
};

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrator',
  HR: 'HR Manager',
  FINANCE: 'Finance',
  EMPLOYEE: 'Employee',
};

export const REPORT_STATUS_LABELS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_FINANCE_REVIEW: 'Under finance review',
  FINANCE_APPROVED: 'Finance approved',
  FINANCE_REJECTED: 'Finance rejected',
  CORRECTION_REQUESTED: 'Correction requested',
  FORWARDED_TO_HR: 'Forwarded to HR',
  UNDER_HR_REVIEW: 'Under HR review',
  HR_APPROVED: 'HR approved',
  HR_REJECTED: 'HR rejected',
  COMPLETED: 'Completed',
};

export const ATTENDANCE_STATUS_LABELS = {
  PRESENT: 'Present',
  WFH: 'Work from home',
  ABSENT: 'Absent',
  HALF_DAY: 'Half day',
  LATE: 'Late',
  EARLY_DEPARTURE: 'Early departure',
  ON_LEAVE: 'On leave',
  HOLIDAY: 'Holiday',
  WEEKLY_OFF: 'Weekly off',
};

export const WFH_STATUS_LABELS = {
  PENDING: 'Pending manager',
  MANAGER_APPROVED: 'Pending HR',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const WFH_MODE_LABELS = {
  WFH: 'Work from home',
  REMOTE: 'Remote work',
  HYBRID: 'Hybrid',
};

export const TICKET_STATUS_LABELS = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_ON_EMPLOYEE: 'Waiting on employee',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const TICKET_CATEGORY_LABELS = {
  HR: 'HR',
  IT: 'IT',
  PAYROLL: 'Payroll',
  ATTENDANCE: 'Attendance',
  LEAVE: 'Leave',
  FACILITIES: 'Facilities',
  OTHER: 'Other',
};

export const TICKET_CATEGORIES = Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

export const TICKET_PRIORITY_LABELS = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const EXIT_STATUS_LABELS = {
  PENDING_MANAGER: 'Pending manager',
  PENDING_HR: 'Pending HR',
  APPROVED: 'Approved',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export const EXIT_TYPE_LABELS = {
  RESIGNATION: 'Resignation',
  TERMINATION: 'Termination',
  RETIREMENT: 'Retirement',
  ABSCONDING: 'Absconding',
};

export const CLEARANCE_LABELS = {
  HR: 'HR',
  IT: 'IT',
  FINANCE: 'Finance',
  ADMIN: 'Administration',
  DEPARTMENT: 'Department handover',
};

export const LEAVE_STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const EMPLOYMENT_STATUS_LABELS = {
  ACTIVE: 'Active',
  PROBATION: 'Probation',
  NOTICE_PERIOD: 'Notice period',
  INACTIVE: 'Inactive',
  TERMINATED: 'Terminated',
};

export const EMPLOYMENT_TYPE_LABELS = {
  FULL_TIME: 'Full time',
  PART_TIME: 'Part time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
  CONSULTANT: 'Consultant',
};

export const PAYROLL_STATUS_LABELS = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  PAID: 'Paid',
};

export const REIMBURSEMENT_STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PAID: 'Paid',
};

export const RECRUITMENT_STAGE_LABELS = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  TECHNICAL: 'Technical',
  HR_ROUND: 'HR round',
  OFFER: 'Offer',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
};

export const DOCUMENT_CATEGORIES = [
  { value: 'RESUME', label: 'Resume / CV' },
  { value: 'IDENTITY', label: 'Identity proof' },
  { value: 'EDUCATION', label: 'Education certificate' },
  { value: 'EMPLOYMENT', label: 'Employment document' },
  { value: 'OFFER_LETTER', label: 'Offer letter' },
  { value: 'APPOINTMENT_LETTER', label: 'Appointment letter' },
  { value: 'EXPERIENCE_LETTER', label: 'Experience letter' },
  { value: 'PAYSLIP', label: 'Payslip' },
  { value: 'OTHER', label: 'Other' },
];

export const ASSET_CATEGORIES = [
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'ACCESS_CARD', label: 'Access card' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'OTHER', label: 'Other' },
];

export const formatEnum = (value) =>
  String(value || '')
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
