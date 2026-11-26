import { Link } from 'react-router-dom';
import { Building2, ClipboardCheck, Plus, UserPlus, Users, Laptop, Briefcase, CalendarDays } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import {
  ActivityCard,
  DashboardHero,
  DepartmentCard,
  PendingApprovalsCard,
  PeopleMomentsCard,
  PulseTiles,
  QuickActions,
  StatStrip,
} from './DashboardKit';

const AdminDashboard = ({ data }) => {
  const { user } = useAuth();
  const cards = data.cards || {};

  return (
    <div className="space-y-4">
      <DashboardHero
        eyebrow="Administration"
        name={user?.name}
        title="Operational overview"
        description={`Employee records, attendance and day-to-day operations for ${data.company?.name}.`}
        pulse={data.pulse}
        actions={[
          <Link key="add" to="/employees/new" className="btn btn-primary">
            <Plus size={16} /> Add employee
          </Link>,
          <Link key="attendance" to="/attendance/records" className="btn btn-secondary">
            <CalendarDays size={16} /> Attendance
          </Link>,
        ]}
      />

      <PulseTiles pulse={data.pulse} />

      <StatStrip
        items={[
          { label: 'Total employees', value: cards.totalEmployees ?? 0, hint: `${cards.activeEmployees ?? 0} active`, icon: Users, tone: 'lavender', to: '/employees' },
          { label: 'Departments', value: cards.departments ?? 0, hint: 'Organizational units', icon: Building2, tone: 'sky', to: '/organization' },
          { label: 'Onboarding tasks', value: cards.pendingOnboardingTasks ?? 0, hint: 'Pending completion', icon: ClipboardCheck, tone: 'peach', to: '/onboarding' },
          { label: 'New joiners', value: cards.newJoiners ?? 0, hint: 'This month', icon: UserPlus, tone: 'mint', to: '/employees' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DepartmentCard departments={data.departments || []} description="Active employees per department" />
        </div>
        <PendingApprovalsCard pulse={data.pulse} reportLink="/leave/approvals" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ActivityCard
            activities={data.recentActivities || []}
            description="Recent changes in people operations"
            action={
              <Link to="/audit-logs" className="btn btn-secondary btn-sm">
                Audit log
              </Link>
            }
          />
        </div>
        <PeopleMomentsCard pulse={data.pulse} />
      </div>

      <div>
        <div className="mb-3">
          <h2 className="section-title">Quick actions</h2>
          <p className="text-sm text-slate-500">Common administration workflows.</p>
        </div>
        <QuickActions
          actions={[
            { label: 'Add employee', description: 'Create profile and login account', to: '/employees/new', icon: UserPlus, tone: 'aqua' },
            { label: 'Departments', description: 'Maintain the organization structure', to: '/organization', icon: Building2, tone: 'lavender' },
            { label: 'Company assets', description: 'Allocate and track equipment', to: '/assets', icon: Laptop, tone: 'mint' },
            { label: 'Recruitment', description: 'Openings, candidates and interviews', to: '/recruitment', icon: Briefcase, tone: 'peach' },
          ]}
        />
      </div>
    </div>
  );
};

export default AdminDashboard;
