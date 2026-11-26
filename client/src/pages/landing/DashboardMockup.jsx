import {
  Bell,
  CalendarDays,
  Check,
  Clock,
  Home,
  LayoutDashboard,
  Search,
  Users,
  Wallet,
} from 'lucide-react';

/**
 * Illustrative product UI modelled on the real application screens.
 * The numbers here are sample values for marketing display, never a live feed.
 */

const Chip = ({ children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${className}`}>{children}</span>
);

const Sidebar = ({ active = 'Dashboard' }) => {
  const items = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'People', icon: Users },
    { label: 'Attendance', icon: Clock },
    { label: 'Leave', icon: CalendarDays },
    { label: 'Remote', icon: Home },
    { label: 'Payroll', icon: Wallet },
  ];
  return (
    <aside className="hidden w-[104px] shrink-0 flex-col gap-1 border-r border-slate-100 bg-white/55 p-2 sm:flex">
      <div className="mb-2 flex items-center gap-1.5 px-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-gradient text-[9px] font-bold text-white">N</span>
        <span className="text-[9px] font-semibold text-slate-700">Northwind</span>
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.label === active;
        return (
          <div
            key={item.label}
            className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[9px] ${
              isActive ? 'bg-white font-semibold text-slate-800 shadow-sm ring-1 ring-slate-100' : 'text-slate-500'
            }`}
          >
            <Icon size={11} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
            {item.label}
          </div>
        );
      })}
    </aside>
  );
};

const TopBar = ({ title }) => (
  <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
    <div className="flex items-center gap-1.5">
      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-widest text-slate-500">
        {title}
      </span>
    </div>
    <div className="flex items-center gap-1.5">
      <span className="flex h-4 w-4 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400">
        <Bell size={8} />
      </span>
      <span className="rounded-full bg-gradient-to-br from-aqua-200 to-lavender-200 px-1.5 py-0.5 text-[8px] font-semibold text-indigo-700">
        AM
      </span>
    </div>
  </div>
);

const Kpi = ({ label, value, tint }) => (
  <div className={`rounded-lg border border-white p-2 shadow-sm ${tint}`}>
    <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-0.5 font-display text-[15px] font-semibold text-slate-900">{value}</p>
  </div>
);

const Ring = ({ value = 86 }) => {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
      <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(226,232,240,0.9)" strokeWidth="7" />
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        stroke="url(#mockRing)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - (value / 100) * circumference}
      />
      <defs>
        <linearGradient id="mockRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3ccbe0" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const DashboardScreen = () => (
  <div className="space-y-2 p-3">
    <div className="flex items-end justify-between">
      <div>
        <p className="text-[8px] font-semibold uppercase tracking-widest text-indigo-500">Monday, 22 November</p>
        <p className="font-display text-[13px] font-semibold text-slate-900">Good morning, Arjun.</p>
      </div>
      <span className="rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-2 py-1 text-[8px] font-semibold text-white">
        Add employee
      </span>
    </div>

    <div className="grid grid-cols-4 gap-1.5">
      <Kpi label="Present" value="48" tint="tile-mint" />
      <Kpi label="Remote" value="12" tint="tile-aqua" />
      <Kpi label="On leave" value="4" tint="tile-lavender" />
      <Kpi label="Pending" value="7" tint="tile-peach" />
    </div>

    <div className="grid grid-cols-5 gap-1.5">
      <div className="col-span-3 rounded-lg border border-slate-100 bg-white p-2">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-semibold text-slate-700">Pending approvals</p>
          <Chip className="bg-amber-50 text-amber-600">5 open</Chip>
        </div>
        <div className="mt-1.5 space-y-1">
          {[
            ['Leave · Sara Iyer', '2 days casual'],
            ['Remote · Karan Patel', 'Manager approved'],
            ['Expense · Ritika Nair', 'Receipt attached'],
            ['Exit · Vikram Desai', 'Clearances'],
          ].map(([title, meta]) => (
            <div key={title} className="flex items-center justify-between rounded-md bg-slate-50/80 px-1.5 py-1">
              <div>
                <p className="text-[8px] font-medium text-slate-700">{title}</p>
                <p className="text-[7px] text-slate-400">{meta}</p>
              </div>
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Check size={7} />
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="col-span-2 rounded-lg border border-slate-100 bg-white p-2">
        <p className="text-[9px] font-semibold text-slate-700">Today&apos;s attendance</p>
        <div className="mt-1 flex items-center gap-1.5">
          <Ring value={86} />
          <div className="space-y-0.5 text-[7px] text-slate-500">
            <p className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-emerald-400" /> On desk 48</p>
            <p className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-sky-400" /> Remote 12</p>
            <p className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-violet-400" /> Leave 4</p>
          </div>
        </div>
        <div className="mt-1.5 space-y-1">
          {[
            ['Earned leave', 68, 'bg-lavender-400'],
            ['Casual leave', 45, 'bg-aqua-400'],
          ].map(([label, width, color]) => (
            <div key={label}>
              <p className="text-[7px] text-slate-500">{label}</p>
              <div className="mt-0.5 h-1 rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-gradient-to-r from-peach-50 via-blush-50 to-lavender-50 px-2 py-1.5">
      <span className="text-[9px]">🎂</span>
      <p className="text-[8px] text-slate-600">Sara Iyer · birthday today</p>
      <span className="ml-auto text-[8px] text-slate-500">Holiday · 26 Nov</span>
    </div>
  </div>
);

const EmployeesScreen = () => (
  <div className="space-y-2 p-3">
    <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[8px] text-slate-400">
      <Search size={8} /> Search people, employee ID or department
    </div>
    <div className="grid grid-cols-3 gap-1.5">
      {[
        ['Sara Iyer', 'Product Designer', 'Design', 'from-aqua-200 to-sky-200'],
        ['Karan Patel', 'Backend Engineer', 'Engineering', 'from-lavender-200 to-violet-200'],
        ['Ritika Nair', 'HR Executive', 'People', 'from-mint-200 to-pista-200'],
        ['Vikram Desai', 'Finance Analyst', 'Finance', 'from-peach-200 to-coral-200'],
        ['Aditya Sharma', 'QA Engineer', 'Engineering', 'from-blush-200 to-lavender-200'],
        ['Neha Kapoor', 'HR Manager', 'People', 'from-sun-200 to-peach-200'],
      ].map(([name, role, dept, tint]) => (
        <div key={name} className="rounded-lg border border-slate-100 bg-white p-1.5">
          <div className="flex items-center gap-1.5">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br text-[7px] font-bold text-slate-700 ${tint}`}>
              {name.split(' ').map((part) => part[0]).join('')}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[8px] font-semibold text-slate-800">{name}</p>
              <p className="truncate text-[7px] text-slate-400">{role}</p>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="rounded-full bg-slate-50 px-1 py-0.5 text-[6px] text-slate-500">{dept}</span>
            <span className="rounded-full bg-emerald-50 px-1 py-0.5 text-[6px] font-semibold text-emerald-600">Active</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AttendanceScreen = () => (
  <div className="space-y-2 p-3">
    <div className="flex items-center justify-between">
      <p className="text-[9px] font-semibold text-slate-700">My attendance · November</p>
      <Chip className="bg-emerald-50 text-emerald-600">Checked in 09:12</Chip>
    </div>
    <div className="rounded-lg border border-slate-100 bg-white p-2">
      <div className="grid grid-cols-7 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((day) => {
          const state = day % 7 === 0 ? 'bg-slate-100 text-slate-400' : day === 14 ? 'bg-indigo-500 text-white' : 'bg-emerald-50 text-emerald-700';
          return (
            <div key={day} className={`rounded-md px-1 py-1 text-center text-[7px] font-semibold ${state}`}>
              {day}
              <span className="mt-0.5 block h-0.5 w-full rounded-full bg-current opacity-40" />
            </div>
          );
        })}
      </div>
    </div>
    <div className="grid grid-cols-3 gap-1.5">
      <Kpi label="Effective hours" value="7h 46m" tint="tile-sky" />
      <Kpi label="Late marks" value="0" tint="tile-sun" />
      <Kpi label="Remote days" value="6" tint="tile-aqua" />
    </div>
    <div className="rounded-lg border border-slate-100 bg-white p-2 text-[8px] text-slate-500">
      Breaks are excluded automatically. Need a fix? Request a correction with a reason for approval.
    </div>
  </div>
);

const LeaveScreen = () => (
  <div className="space-y-2 p-3">
    <div className="grid grid-cols-3 gap-1.5">
      <Kpi label="Earned" value="12 / 18" tint="tile-lavender" />
      <Kpi label="Casual" value="6 / 10" tint="tile-aqua" />
      <Kpi label="Sick" value="4 / 8" tint="tile-mint" />
    </div>
    <div className="rounded-lg border border-slate-100 bg-white p-2">
      <p className="text-[9px] font-semibold text-slate-700">My requests</p>
      <div className="mt-1.5 space-y-1">
        {[
          ['Casual leave · 24 Nov', 'Pending', 'bg-amber-50 text-amber-600'],
          ['Earned leave · 18–19 Nov', 'Approved', 'bg-emerald-50 text-emerald-600'],
          ['Sick leave · 06 Nov', 'Approved', 'bg-emerald-50 text-emerald-600'],
        ].map(([title, status, tone]) => (
          <div key={title} className="flex items-center justify-between rounded-md bg-slate-50/80 px-1.5 py-1">
            <span className="text-[8px] text-slate-600">{title}</span>
            <Chip className={tone}>{status}</Chip>
          </div>
        ))}
      </div>
    </div>
    <div className="rounded-lg bg-gradient-to-r from-mint-50 to-aqua-50 p-2 text-[8px] text-slate-600">
      Approvals route to your reporting manager, then HR when policy requires it.
    </div>
  </div>
);

const PayrollScreen = () => (
  <div className="space-y-2 p-3">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[8px] uppercase tracking-widest text-slate-400">Payroll period</p>
        <p className="font-display text-[12px] font-semibold text-slate-900">November 2026</p>
      </div>
      <Chip className="bg-sky-50 text-sky-600">Draft</Chip>
    </div>
    <div className="grid grid-cols-3 gap-1.5">
      <Kpi label="Gross" value="₹18.4L" tint="tile-aqua" />
      <Kpi label="Net" value="₹15.9L" tint="tile-mint" />
      <Kpi label="Processed" value="64" tint="tile-lavender" />
    </div>
    <div className="rounded-lg border border-slate-100 bg-white p-2">
      <p className="text-[9px] font-semibold text-slate-700">Payslips</p>
      {['Sara Iyer', 'Karan Patel', 'Ritika Nair'].map((name) => (
        <div key={name} className="mt-1 flex items-center justify-between text-[8px] text-slate-600">
          <span>{name}</span>
          <span className="rounded bg-slate-50 px-1 py-0.5 text-[7px] text-slate-500">PDF ready</span>
        </div>
      ))}
    </div>
  </div>
);

const RecruitmentScreen = () => (
  <div className="space-y-2 p-3">
    <div className="flex items-center justify-between">
      <p className="text-[9px] font-semibold text-slate-700">Candidate pipeline</p>
      <Chip className="bg-lavender-50 text-lavender-600">5 open roles</Chip>
    </div>
    <div className="grid grid-cols-3 gap-1.5">
      {[
        ['Screening', ['Ananya R.', 'Rohit S.'], 'from-aqua-100 to-sky-100'],
        ['Interview', ['Meera K.'], 'from-lavender-100 to-violet-100'],
        ['Offer', ['Dev P.'], 'from-peach-100 to-coral-100'],
      ].map(([stage, people, tint]) => (
        <div key={stage} className="rounded-lg border border-slate-100 bg-slate-50/60 p-1.5">
          <p className={`rounded bg-gradient-to-r px-1 py-0.5 text-center text-[7px] font-semibold text-slate-700 ${tint}`}>{stage}</p>
          <div className="mt-1 space-y-1">
            {people.map((person) => (
              <div key={person} className="rounded-md border border-white bg-white px-1 py-1 text-[7px] text-slate-600 shadow-sm">
                {person}
                <span className="mt-0.5 block text-[6px] text-slate-400">Technical round</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
    <div className="rounded-lg bg-gradient-to-r from-lavender-50 to-blush-50 p-2 text-[8px] text-slate-600">
      Hire converts a candidate into an employee with a login and onboarding checklist.
    </div>
  </div>
);

const screens = {
  dashboard: DashboardScreen,
  employees: EmployeesScreen,
  attendance: AttendanceScreen,
  leave: LeaveScreen,
  payroll: PayrollScreen,
  recruitment: RecruitmentScreen,
};

const screenTitles = {
  dashboard: 'Dashboard',
  employees: 'Employee directory',
  attendance: 'Attendance',
  leave: 'Leave',
  payroll: 'Payroll',
  recruitment: 'Recruitment',
};

const DashboardMockup = ({ screen = 'dashboard', className = '', compact = false }) => {
  const Screen = screens[screen] || DashboardScreen;
  return (
    <div className={`mock-window ${className}`}>
      <div className="mock-chrome">
        <span className="mock-dot bg-[#ffb3ab]" />
        <span className="mock-dot bg-[#ffe08a]" />
        <span className="mock-dot bg-[#a7f0cb]" />
        <span className="ml-2 rounded-md bg-white/80 px-2 py-0.5 text-[8px] font-medium text-slate-500 ring-1 ring-slate-100">
          HRMS · {screenTitles[screen]}
        </span>
        <span className="ml-auto hidden rounded-full bg-emerald-50 px-1.5 py-0.5 text-[7px] font-semibold text-emerald-600 sm:block">
          Live product preview
        </span>
      </div>
      <div className="flex">
        <Sidebar active={screen === 'dashboard' ? 'Dashboard' : screen === 'employees' ? 'People' : screen.charAt(0).toUpperCase() + screen.slice(1)} />
        <div className="min-w-0 flex-1">
          {compact ? null : <TopBar title={screenTitles[screen]} />}
          <Screen />
        </div>
      </div>
    </div>
  );
};

export default DashboardMockup;
