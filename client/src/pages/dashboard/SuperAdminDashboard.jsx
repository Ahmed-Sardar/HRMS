import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BadgeIndianRupee,
  Building2,
  Laptop,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { Card, CardHeader } from '../../components/ui/Card';
import { RoleBadge } from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
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
import { formatCurrency, relativeTime } from '../../utils/format';
import { ROLE_LABELS } from '../../utils/constants';

const SuperAdminDashboard = ({ data }) => {
  const { user } = useAuth();
  const cards = data.cards || {};

  return (
    <div className="space-y-4">
      <DashboardHero
        eyebrow="System overview"
        name={user?.name}
        title="Organization control center"
        description={`Complete visibility across people, attendance, approvals and payroll for ${data.company?.name}.`}
        pulse={data.pulse}
        actions={[
          <Link key="add" to="/employees/new" className="btn btn-primary">
            <Plus size={16} /> Add employee
          </Link>,
          <Link key="payroll" to="/payroll" className="btn btn-secondary">
            <Wallet size={16} /> Payroll register
          </Link>,
          <Link key="audit" to="/audit-logs" className="btn btn-secondary">
            <ScrollText size={16} /> Audit trail
          </Link>,
        ]}
      />

      <PulseTiles pulse={data.pulse} />

      <StatStrip
        items={[
          { label: 'Total employees', value: cards.totalEmployees ?? 0, hint: `${cards.activeEmployees ?? 0} active`, icon: Users, tone: 'lavender', to: '/employees' },
          { label: 'Monthly payroll', value: formatCurrency(cards.payrollNet || 0), hint: `${cards.payrollCount || 0} employees processed`, icon: Wallet, tone: 'mint', to: '/payroll' },
          { label: 'Departments', value: cards.departments ?? 0, hint: 'Organizational units', icon: Building2, tone: 'sky', to: '/organization' },
          { label: 'Assets available', value: cards.availableAssets ?? 0, hint: `${cards.assignedAssets ?? 0} currently assigned`, icon: Laptop, tone: 'peach', to: '/assets' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ActivityCard
            activities={data.recentActivities || []}
            description="Audit trail across every module"
            action={
              <Link to="/audit-logs" className="btn btn-secondary btn-sm">
                Full log
              </Link>
            }
          />
        </div>
        <PendingApprovalsCard pulse={data.pulse} reportLink="/hr/reviews" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="h-full">
          <CardHeader title="Accounts by role" description="Active user accounts" icon={ShieldCheck} />
          <div className="space-y-2.5 p-5">
            {Object.entries(data.usersByRole || {}).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between">
                <RoleBadge role={role} />
                <span className="font-display text-sm font-semibold text-slate-800">{count}</span>
              </div>
            ))}
            {!Object.keys(data.usersByRole || {}).length ? <p className="text-sm text-slate-500">No accounts.</p> : null}
            <Link to="/users" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">
              Manage accounts <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="space-y-2 border-t border-white/70 p-5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Finance queue</span>
              <Link to="/finance/reviews" className="font-semibold text-navy-700 hover:underline">
                {cards.pendingFinance ?? 0}
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">HR queue</span>
              <Link to="/hr/reviews" className="font-semibold text-navy-700 hover:underline">
                {cards.pendingHr ?? 0}
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Open reports</span>
              <span className="font-semibold text-slate-900">{cards.openReports ?? 0}</span>
            </div>
          </div>
        </Card>
        <PeopleMomentsCard pulse={data.pulse} />
        <div className="space-y-4">
          <Card className="h-full">
            <CardHeader title="Operational health" description="Requires attention" icon={BadgeIndianRupee} />
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">New joiners this month</span>
                <Link to="/employees" className="font-semibold text-navy-700 hover:underline">
                  {cards.newJoiners ?? 0}
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Onboarding tasks pending</span>
                <Link to="/onboarding" className="font-semibold text-navy-700 hover:underline">
                  Review
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Company policies</span>
                <Link to="/settings" className="font-semibold text-navy-700 hover:underline">
                  Configure
                </Link>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-aqua-50 to-lavender-50 p-3 text-[11px] leading-relaxed text-slate-600">
                Signed in as {ROLE_LABELS.SUPER_ADMIN} — full access to every module, policy and audit record.
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="section-title">Quick actions</h2>
            <p className="text-sm text-slate-500">Jump straight into the workflows you use most.</p>
          </div>
        </div>
        <QuickActions
          actions={[
            { label: 'Add employee', description: 'Create profile and login account', to: '/employees/new', icon: UserPlus, tone: 'aqua' },
            { label: 'Organization', description: 'Departments and designations', to: '/organization', icon: Building2, tone: 'lavender' },
            { label: 'Company assets', description: 'Allocate and track equipment', to: '/assets', icon: Laptop, tone: 'mint' },
            { label: 'Company settings', description: 'Policies, leave and payroll rules', to: '/settings', icon: Settings, tone: 'peach' },
          ]}
        />
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
