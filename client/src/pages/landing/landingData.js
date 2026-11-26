import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Clock,
  FileText,
  Home,
  Laptop,
  LifeBuoy,
  LogOut,
  Megaphone,
  Receipt,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';

/**
 * Only modules that exist in this codebase are listed as available.
 * Training/LMS, OKR cycles and biometric ingestion are intentionally kept on
 * the roadmap instead of being advertised as shipped features.
 */
export const modules = [
  {
    icon: Users,
    title: 'Employee management',
    description: 'Profiles, departments, designations, reporting lines, documents and full employment history.',
    tint: 'from-aqua-100 via-sky-100 to-white',
    to: '/login',
  },
  {
    icon: Clock,
    title: 'Attendance',
    description: 'Check-in and out, multi-break tracking, late and early marks, corrections and monthly calendars.',
    tint: 'from-lavender-100 via-violet-100 to-white',
    to: '/login',
  },
  {
    icon: CalendarDays,
    title: 'Leave management',
    description: 'Balances, request forms, approval chains, team calendars and complete leave history.',
    tint: 'from-mint-100 via-emerald-100 to-white',
    to: '/login',
  },
  {
    icon: Home,
    title: 'Work from home',
    description: 'Policy limits, hybrid requests, manager and HR approval, and automatic attendance marking.',
    tint: 'from-pista-100 via-lime-100 to-white',
    to: '/login',
  },
  {
    icon: Wallet,
    title: 'Payroll',
    description: 'Salary structures, allowances, deductions, register processing, approval and PDF payslips.',
    tint: 'from-peach-100 via-orange-100 to-white',
    to: '/login',
  },
  {
    icon: Briefcase,
    title: 'Recruitment & ATS',
    description: 'Job openings, candidate pipeline, interview scheduling, feedback and one-click hiring.',
    tint: 'from-coral-100 via-rose-100 to-white',
    to: '/login',
  },
  {
    icon: Target,
    title: 'Performance',
    description: 'Goals, periodic performance reports and the finance to HR review workflow with ratings.',
    tint: 'from-blush-100 via-pink-100 to-white',
    to: '/login',
  },
  {
    icon: UserCheck,
    title: 'Onboarding',
    description: 'Joining checklists with owners and due dates, task progress and employee conversion from hiring.',
    tint: 'from-sky-100 via-aqua-100 to-white',
    to: '/login',
  },
  {
    icon: LogOut,
    title: 'Offboarding',
    description: 'Resignation workflow, department clearances, asset return, exit interview and final settlement.',
    tint: 'from-sun-100 via-amber-100 to-white',
    to: '/login',
  },
  {
    icon: Receipt,
    title: 'Expenses',
    description: 'Employee reimbursements with receipts, finance review, approval status and payment tracking.',
    tint: 'from-peach-100 via-sun-100 to-white',
    to: '/login',
  },
  {
    icon: Laptop,
    title: 'Asset management',
    description: 'Company asset registry, assignment and return history, condition tracking and availability.',
    tint: 'from-aqua-100 via-mint-100 to-white',
    to: '/login',
  },
  {
    icon: FileText,
    title: 'Documents',
    description: 'Central employee document store with categories, verification status and secure downloads.',
    tint: 'from-lavender-100 via-blush-100 to-white',
    to: '/login',
  },
  {
    icon: LifeBuoy,
    title: 'HR helpdesk',
    description: 'Support tickets by category and priority, assigned owners, threaded comments and resolution.',
    tint: 'from-mint-100 via-pista-100 to-white',
    to: '/login',
  },
  {
    icon: BarChart3,
    title: 'Reports & exports',
    description: 'Filterable registers and CSV or Excel exports across attendance, payroll and people data.',
    tint: 'from-sky-100 via-lavender-100 to-white',
    to: '/login',
  },
  {
    icon: Megaphone,
    title: 'Announcements',
    description: 'Targeted company updates, pinned notices, role-based visibility and notification delivery.',
    tint: 'from-blush-100 via-peach-100 to-white',
    to: '/login',
  },
  {
    icon: ShieldCheck,
    title: 'Roles & audit',
    description: 'Granular role permissions, account management and an immutable audit trail of every action.',
    tint: 'from-slate-100 via-lavender-100 to-white',
    to: '/login',
  },
];

export const lifecycle = [
  {
    icon: Briefcase,
    title: 'Recruitment',
    copy: 'Open roles, screening, interviews and offers in a single pipeline.',
  },
  {
    icon: UserCheck,
    title: 'Onboarding',
    copy: 'Checklists, documents and accounts ready before day one.',
  },
  {
    icon: Users,
    title: 'Employee records',
    copy: 'One profile for personal, job, bank and document details.',
  },
  {
    icon: Clock,
    title: 'Attendance & WFH',
    copy: 'Daily presence, breaks, remote days and corrections.',
  },
  {
    icon: Target,
    title: 'Goals & performance',
    copy: 'Periodic reports reviewed by finance and HR.',
  },
  {
    icon: Wallet,
    title: 'Payroll & rewards',
    copy: 'Structures, reimbursements and published payslips.',
  },
  {
    icon: LogOut,
    title: 'Offboarding',
    copy: 'Clearances, asset return, settlement and relieving letters.',
  },
];

export const challenges = [
  'Attendance tracked in spreadsheets',
  'Leave approvals lost in chat threads',
  'Payroll inputs rebuilt every month',
  'Employee documents scattered across drives',
  'No visibility into who is working remotely',
  'Offboarding steps forgotten under deadline pressure',
];

export const benefits = [
  {
    title: 'Approvals that move themselves',
    copy: 'Manager and HR chains are enforced by policy, with every decision time-stamped in the audit trail.',
    tone: 'from-aqua-50 via-sky-50 to-white',
  },
  {
    title: 'Employee self-service',
    copy: 'People apply for leave and remote work, check attendance, download payslips and raise tickets without emailing HR.',
    tone: 'from-lavender-50 via-violet-50 to-white',
  },
  {
    title: 'Access you can defend',
    copy: 'Role-based permissions per module, protected sessions, rate limiting and a permanent record of who changed what.',
    tone: 'from-mint-50 via-pista-50 to-white',
  },
  {
    title: 'One source of truth',
    copy: 'Attendance, leave, remote days and payroll read from the same records, so month-end stops being a reconciliation exercise.',
    tone: 'from-peach-50 via-blush-50 to-white',
  },
];

export const faqs = [
  {
    q: 'Who is this HRMS built for?',
    a: 'Growing organizations that need structured people operations without stitching five tools together — HR teams, finance, managers and employees all work from the same records.',
  },
  {
    q: 'Does it work on mobile?',
    a: 'Yes. The interface is responsive across desktop, tablet and phone, including attendance, leave, work-from-home requests and payslips.',
  },
  {
    q: 'How are roles and permissions handled?',
    a: 'Every route and API is permission-checked. Super admins, admins, HR, finance and employees each see only the modules and actions granted to their role.',
  },
  {
    q: 'How is payroll calculated?',
    a: 'Salary structures are configurable components (earnings and deductions). Payroll uses recorded attendance, approved leave and paid days. Statutory tax rules are not hard-coded — they stay configurable.',
  },
  {
    q: 'Where does the data live?',
    a: 'In your own MongoDB deployment, accessed through the application API. Documents are stored by the backend and served only to authorized users.',
  },
  {
    q: 'Is training and learning available?',
    a: 'Not yet. Learning programmes, OKR cycles and biometric device ingestion are on the roadmap; this page only lists modules that are implemented today.',
  },
];

export const showcaseScreens = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'employees', label: 'Directory' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'leave', label: 'Leave' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'recruitment', label: 'Hiring' },
];

export const navLinks = [
  { label: 'Platform', href: '#platform' },
  { label: 'Modules', href: '#modules' },
  { label: 'Lifecycle', href: '#lifecycle' },
  { label: 'Why us', href: '#why' },
  { label: 'FAQ', href: '#faq' },
];
