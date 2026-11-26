import {
  LayoutDashboard,
  Users,
  Building2,
  Clock,
  CalendarDays,
  Target,
  Wallet,
  ShieldCheck,
  UserCheck,
  FileText,
  Laptop,
  Megaphone,
  Settings,
  ScrollText,
  Bell,
  Briefcase,
  BadgeIndianRupee,
  CalendarClock,
  ClipboardCheck,
  UserCog,
  FolderKanban,
  Home,
  LogOut,
  LifeBuoy,
  Sparkles,
} from 'lucide-react';
import { ROLES } from './constants';

const { SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE } = ROLES;

export const navigation = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE] },
      { label: 'Announcements', to: '/announcements', icon: Megaphone, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE] },
      { label: 'Notifications', to: '/notifications', icon: Bell, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE] },
    ],
  },
  {
    section: 'People',
    items: [
      { label: 'Employees', to: '/employees', icon: Users, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE] },
      { label: 'Organization', to: '/organization', icon: Building2, roles: [SUPER_ADMIN, ADMIN, HR] },
      { label: 'User accounts', to: '/users', icon: UserCog, roles: [SUPER_ADMIN, ADMIN] },
      { label: 'Recruitment', to: '/recruitment', icon: Briefcase, roles: [SUPER_ADMIN, ADMIN, HR] },
      { label: 'Onboarding', to: '/onboarding', icon: UserCheck, roles: [SUPER_ADMIN, ADMIN, HR] },
      { label: 'Exit management', to: '/exit', icon: LogOut, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE] },
      { label: 'Helpdesk', to: '/helpdesk', icon: LifeBuoy, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE] },
    ],
  },
  {
    section: 'Time & attendance',
    items: [
      { label: 'My attendance', to: '/attendance/my', icon: CalendarClock, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE] },
      { label: 'Attendance records', to: '/attendance/records', icon: Clock, roles: [SUPER_ADMIN, ADMIN, HR] },
      { label: 'Corrections', to: '/attendance/corrections', icon: ClipboardCheck, roles: [SUPER_ADMIN, ADMIN, HR, EMPLOYEE] },
      { label: 'Shifts', to: '/attendance/shifts', icon: CalendarDays, roles: [SUPER_ADMIN, ADMIN] },
      { label: 'Holidays', to: '/attendance/holidays', icon: CalendarDays, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE] },
    ],
  },
  {
    section: 'Leave',
    items: [
      { label: 'My leave', to: '/leave/my', icon: CalendarDays, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE] },
      { label: 'Work from home', to: '/wfh', icon: Home, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE] },
      { label: 'Leave approvals', to: '/leave/approvals', icon: ClipboardCheck, roles: [SUPER_ADMIN, ADMIN, HR] },
      { label: 'Team calendar', to: '/leave/calendar', icon: CalendarClock, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE] },
    ],
  },
  {
    section: 'Performance',
    items: [
      { label: 'My reports', to: '/performance/reports', icon: FileText, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE] },
      { label: 'Goals', to: '/performance/goals', icon: Target, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE] },
      { label: 'Finance reviews', to: '/finance/reviews', icon: BadgeIndianRupee, roles: [SUPER_ADMIN, FINANCE] },
      { label: 'Reimbursements', to: '/finance/reimbursements', icon: Wallet, roles: [SUPER_ADMIN, FINANCE] },
      { label: 'HR reviews', to: '/hr/reviews', icon: ShieldCheck, roles: [SUPER_ADMIN, HR] },
    ],
  },
  {
    section: 'Payroll',
    items: [
      { label: 'Payroll register', to: '/payroll', icon: Wallet, roles: [SUPER_ADMIN, FINANCE] },
      { label: 'Salary structures', to: '/payroll/salary-structures', icon: FolderKanban, roles: [SUPER_ADMIN, FINANCE, HR] },
      { label: 'My payslips', to: '/payroll/my', icon: BadgeIndianRupee, roles: [SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE] },
    ],
  },
  {
    section: 'Records',
    items: [
      { label: 'Documents', to: '/documents', icon: FileText, roles: [SUPER_ADMIN, ADMIN, HR, EMPLOYEE] },
      { label: 'Company assets', to: '/assets', icon: Laptop, roles: [SUPER_ADMIN, ADMIN, HR, EMPLOYEE] },
    ],
  },
  {
    section: 'Administration',
    items: [
      { label: 'Automation', to: '/automation', icon: Sparkles, roles: [SUPER_ADMIN, ADMIN, HR] },
      { label: 'Company settings', to: '/settings', icon: Settings, roles: [SUPER_ADMIN] },
      { label: 'Audit logs', to: '/audit-logs', icon: ScrollText, roles: [SUPER_ADMIN] },
    ],
  },
];

export const navigationForRole = (role) =>
  navigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);

export const hasAnyRole = (role, allowed = []) => allowed.includes(role);
