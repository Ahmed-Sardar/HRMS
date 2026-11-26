import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, FileText, ShieldCheck, UserCheck, Users, LifeBuoy, Home } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { ProgressRing } from '../../components/ui/Progress';
import {
  DashboardHero,
  DepartmentCard,
  PeopleMomentsCard,
  PendingApprovalsCard,
  PulseTiles,
  QuickActions,
  StatStrip,
} from './DashboardKit';
import { formatDate } from '../../utils/format';
import { REPORT_STATUS_LABELS, formatEnum } from '../../utils/constants';

const HrDashboard = ({ data }) => {
  const { user } = useAuth();
  const cards = data.cards || {};
  const progress = cards.onboardingProgress ?? 0;

  return (
    <div className="space-y-4">
      <DashboardHero
        eyebrow="People operations"
        name={user?.name}
        title="HR command center"
        description="Employee lifecycle, leave approvals, hybrid work and performance reviews."
        pulse={data.pulse}
        actions={[
          <Link key="onboard" to="/employees/new" className="btn btn-primary">
            <UserCheck size={16} /> Onboard employee
          </Link>,
          <Link key="reviews" to="/hr/reviews" className="btn btn-secondary">
            <ShieldCheck size={16} /> HR reviews
          </Link>,
        ]}
      />

      <PulseTiles pulse={data.pulse} />

      <StatStrip
        items={[
          { label: 'Active employees', value: cards.totalEmployees ?? 0, hint: 'Current headcount', icon: Users, tone: 'lavender', to: '/employees' },
          { label: 'New joiners', value: cards.newJoiners ?? 0, hint: 'Joined this month', icon: UserCheck, tone: 'mint', to: '/employees' },
          { label: 'Pending leave', value: cards.pendingLeaves ?? 0, hint: 'Awaiting approval', icon: ClipboardCheck, tone: 'sun', to: '/leave/approvals' },
          { label: 'Reports to review', value: cards.reportsAwaitingReview ?? 0, hint: 'Forwarded by finance', icon: FileText, tone: 'peach', to: '/hr/reviews' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Performance reports awaiting review"
            description="Forwarded by Finance and ready for HR review"
            icon={FileText}
            actions={
              <Link to="/hr/reviews" className="btn btn-secondary btn-sm">
                Open queue
              </Link>
            }
          />
          <div className="divide-y divide-white/70">
            {(data.recentReports || []).length ? (
              data.recentReports.map((report) => (
                <Link
                  key={report._id}
                  to={`/performance/reports/${report._id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-white/70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {report.employee?.firstName} {report.employee?.lastName} · {report.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {report.employee?.employeeId} · {formatEnum(report.periodType)} · submitted {formatDate(report.submittedAt)}
                    </p>
                  </div>
                  <StatusBadge status={report.status} labels={REPORT_STATUS_LABELS} />
                </Link>
              ))
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No reports awaiting HR review.</p>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Onboarding progress" description="Tasks across all active employees" icon={UserCheck} />
            <div className="flex items-center gap-5 p-5">
              <ProgressRing value={progress} size={96} tone="mint">
                <span className="font-display text-lg font-semibold text-slate-900">{progress}%</span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Complete</span>
              </ProgressRing>
              <div className="min-w-0 text-sm">
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-900">{cards.onboardingCompleted ?? 0}</span> of{' '}
                  <span className="font-semibold text-slate-900">{cards.onboardingTotal ?? 0}</span> tasks done
                </p>
                <Link to="/onboarding" className="btn btn-secondary btn-sm mt-3 w-full">
                  Manage onboarding
                </Link>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Approval queues" description="Live workload" icon={ClipboardCheck} />
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <CalendarDays size={14} className="text-lavender-500" /> Leave approvals
                </span>
                <Link to="/leave/approvals" className="font-semibold text-navy-700 hover:underline">
                  {cards.pendingLeaves ?? 0}
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <Home size={14} className="text-aqua-500" /> Work from home
                </span>
                <Link to="/wfh" className="font-semibold text-navy-700 hover:underline">
                  {data.pulse?.pending?.wfh ?? 0}
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <LifeBuoy size={14} className="text-mint-500" /> Helpdesk tickets
                </span>
                <Link to="/helpdesk" className="font-semibold text-navy-700 hover:underline">
                  {data.pulse?.pending?.tickets ?? 0}
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <ShieldCheck size={14} className="text-peach-500" /> Approved reports
                </span>
                <span className="font-semibold text-slate-900">{cards.approvedReports ?? 0}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DepartmentCard departments={data.departments || []} description="Distribution across the organization" title="Headcount by department" />
        </div>
        <PeopleMomentsCard pulse={data.pulse} />
      </div>

      <div>
        <div className="mb-3">
          <h2 className="section-title">Quick actions</h2>
          <p className="text-sm text-slate-500">Everything people operations needs, one click away.</p>
        </div>
        <QuickActions
          actions={[
            { label: 'Onboard employee', description: 'Profile, documents and account', to: '/employees/new', icon: UserCheck, tone: 'aqua' },
            { label: 'Leave approvals', description: 'Review pending requests', to: '/leave/approvals', icon: ClipboardCheck, tone: 'lavender' },
            { label: 'Work from home', description: 'Hybrid policy and approvals', to: '/wfh', icon: Home, tone: 'mint' },
            { label: 'Helpdesk', description: 'Employee support tickets', to: '/helpdesk', icon: LifeBuoy, tone: 'peach' },
          ]}
        />
      </div>
    </div>
  );
};

export default HrDashboard;
