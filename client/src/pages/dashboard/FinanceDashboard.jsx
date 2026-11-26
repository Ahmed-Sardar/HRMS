import { Link } from 'react-router-dom';
import {
  BadgeIndianRupee,
  CheckCircle2,
  Clock,
  Receipt,
  Send,
  Wallet,
  XCircle,
  FileSpreadsheet,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import Timeline from '../../components/ui/Timeline';
import {
  DashboardHero,
  PendingApprovalsCard,
  PeopleMomentsCard,
  PulseTiles,
  QuickActions,
  StatStrip,
} from './DashboardKit';
import { formatCurrency, formatDate, monthLabel } from '../../utils/format';
import { REPORT_STATUS_LABELS, formatEnum } from '../../utils/constants';

const FinanceDashboard = ({ data }) => {
  const { user } = useAuth();
  const cards = data.cards || {};

  return (
    <div className="space-y-4">
      <DashboardHero
        eyebrow="Finance operations"
        name={user?.name}
        title="Verification & payroll control"
        description={`Payroll period ${monthLabel(data.month)} · reports verified against attendance and leave data.`}
        pulse={data.pulse}
        actions={[
          <Link key="payroll" to="/payroll" className="btn btn-primary">
            <Wallet size={16} /> Payroll register
          </Link>,
          <Link key="reviews" to="/finance/reviews" className="btn btn-secondary">
            <BadgeIndianRupee size={16} /> Review queue
          </Link>,
          <Link key="reimb" to="/finance/reimbursements" className="btn btn-secondary">
            <Receipt size={16} /> Reimbursements
          </Link>,
        ]}
      />

      <PulseTiles pulse={data.pulse} />

      <StatStrip
        items={[
          { label: 'Awaiting verification', value: cards.awaitingVerification ?? 0, hint: 'Submitted reports', icon: Clock, tone: 'sun', to: '/finance/reviews' },
          { label: 'Finance approved', value: cards.approvedReports ?? 0, hint: 'Ready to forward', icon: CheckCircle2, tone: 'mint', to: '/finance/reviews' },
          { label: 'Rejected', value: cards.rejectedReports ?? 0, hint: 'Returned to employees', icon: XCircle, tone: 'coral', to: '/finance/reviews' },
          { label: 'Forwarded to HR', value: cards.forwardedToHr ?? 0, hint: 'In HR review', icon: Send, tone: 'aqua', to: '/finance/reviews' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Reports submitted for verification"
            description="Verify employee, attendance, leave and performance data before approval"
            icon={FileSpreadsheet}
            actions={
              <Link to="/finance/reviews" className="btn btn-secondary btn-sm">
                View all
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
                      {report.employee?.employeeId} · {formatEnum(report.periodType)} · {formatDate(report.periodStart)} –{' '}
                      {formatDate(report.periodEnd)}
                    </p>
                  </div>
                  <StatusBadge status={report.status} labels={REPORT_STATUS_LABELS} />
                </Link>
              ))
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No reports awaiting verification.</p>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Payroll snapshot" description={monthLabel(data.month)} icon={Wallet} />
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Net payroll</span>
                <span className="font-semibold text-slate-900">{formatCurrency(cards.monthNetPayroll || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Gross payroll</span>
                <span className="font-semibold text-slate-900">{formatCurrency(cards.monthGrossPayroll || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Employees processed</span>
                <span className="font-semibold text-slate-900">{cards.monthPayrollCount ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Draft / approved</span>
                <span className="font-semibold text-slate-900">
                  {cards.payrollPending ?? 0} / {cards.payrollApproved ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/70 pt-2">
                <span className="flex items-center gap-2 text-slate-600">
                  <Receipt size={14} /> Pending reimbursements
                </span>
                <span className="font-semibold text-slate-900">
                  {cards.pendingReimbursements ?? 0} · {formatCurrency(cards.pendingReimbursementAmount || 0)}
                </span>
              </div>
              <Link to="/finance/reimbursements" className="btn btn-secondary btn-sm w-full">
                Review reimbursements
              </Link>
            </div>
          </Card>

          <PendingApprovalsCard pulse={data.pulse} reportLink="/finance/reviews" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader title="Finance approval sequence" description="How a report moves through verification" icon={Send} />
            <div className="p-5">
              <Timeline
                items={[
                  { title: 'Employee submits a report', description: 'Attendance, leave and performance data is attached.', state: 'done' },
                  { title: 'Finance verifies the numbers', description: 'Approve, reject or request a correction with comments.', state: 'current' },
                  { title: 'Forwarded to HR', description: 'Approved reports move to the HR review queue.', state: 'pending' },
                  { title: 'HR final approval', description: 'Completed reports feed payroll and performance history.', state: 'pending' },
                ]}
              />
            </div>
          </Card>
        </div>
        <PeopleMomentsCard pulse={data.pulse} />
      </div>

      <div>
        <div className="mb-3">
          <h2 className="section-title">Quick actions</h2>
          <p className="text-sm text-slate-500">Month-end workflows at a glance.</p>
        </div>
        <QuickActions
          actions={[
            { label: 'Payroll register', description: 'Process and approve payroll', to: '/payroll', icon: Wallet, tone: 'aqua' },
            { label: 'Salary structures', description: 'Components and revisions', to: '/payroll/salary-structures', icon: BadgeIndianRupee, tone: 'lavender' },
            { label: 'Reimbursements', description: 'Approve employee claims', to: '/finance/reimbursements', icon: Receipt, tone: 'mint' },
            { label: 'Finance reviews', description: 'Verify submitted reports', to: '/finance/reviews', icon: FileSpreadsheet, tone: 'peach' },
          ]}
        />
      </div>
    </div>
  );
};

export default FinanceDashboard;
