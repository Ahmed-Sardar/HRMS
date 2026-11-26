import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { bootstrapSession } from './store/authSlice';
import { ROLES } from './utils/constants';
import RequireAuth, { RoleGate } from './components/RequireAuth';
import AppLayout from './layouts/AppLayout';

const LandingPage = lazy(() => import('./pages/landing/LandingPage'));
const LegalPage = lazy(() => import('./pages/landing/LegalPage'));

import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

import DashboardPage from './pages/dashboard/DashboardPage';
import EmployeesPage from './pages/employees/EmployeesPage';
import EmployeeFormPage from './pages/employees/EmployeeFormPage';
import EmployeeDetailPage from './pages/employees/EmployeeDetailPage';
import ProfilePage from './pages/employees/ProfilePage';
import OrganizationPage from './pages/organization/OrganizationPage';
import UsersPage from './pages/users/UsersPage';
import OnboardingPage from './pages/employees/OnboardingPage';
import ExitPage from './pages/exit/ExitPage';
import HelpdeskPage from './pages/helpdesk/HelpdeskPage';
import WfhPage from './pages/wfh/WfhPage';

import MyAttendancePage from './pages/attendance/MyAttendancePage';
import AttendanceRecordsPage from './pages/attendance/AttendanceRecordsPage';
import CorrectionsPage from './pages/attendance/CorrectionsPage';
import ShiftsPage from './pages/attendance/ShiftsPage';
import HolidaysPage from './pages/attendance/HolidaysPage';

import MyLeavePage from './pages/leave/MyLeavePage';
import LeaveApprovalsPage from './pages/leave/LeaveApprovalsPage';
import LeaveCalendarPage from './pages/leave/LeaveCalendarPage';

import MyReportsPage from './pages/performance/MyReportsPage';
import ReportEditorPage from './pages/performance/ReportEditorPage';
import ReportDetailPage from './pages/performance/ReportDetailPage';
import GoalsPage from './pages/performance/GoalsPage';

import FinanceReviewsPage from './pages/finance/FinanceReviewsPage';
import ReimbursementsPage from './pages/finance/ReimbursementsPage';
import HrReviewsPage from './pages/hr/HrReviewsPage';

import PayrollPage from './pages/payroll/PayrollPage';
import SalaryStructuresPage from './pages/payroll/SalaryStructuresPage';
import MyPayslipsPage from './pages/payroll/MyPayslipsPage';

import RecruitmentPage from './pages/recruitment/RecruitmentPage';
import DocumentsPage from './pages/documents/DocumentsPage';
import AssetsPage from './pages/assets/AssetsPage';
import AnnouncementsPage from './pages/announcements/AnnouncementsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import SettingsPage from './pages/settings/SettingsPage';
import AuditLogsPage from './pages/settings/AuditLogsPage';
import AutomationPage from './pages/automation/AutomationPage';
import NotFoundPage from './pages/NotFoundPage';

const { SUPER_ADMIN, ADMIN, HR, FINANCE, EMPLOYEE } = ROLES;

function App() {
  const dispatch = useDispatch();
  const initialized = useSelector((state) => state.auth.initialized);

  useEffect(() => {
    if (!initialized) dispatch(bootstrapSession());
  }, [dispatch, initialized]);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-navy-500 border-t-transparent" aria-label="Loading" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route
            path="automation"
            element={
              <RoleGate roles={[SUPER_ADMIN, ADMIN, HR]}>
                <AutomationPage />
              </RoleGate>
            }
          />

          <Route
            path="employees"
            element={
              <RoleGate roles={[SUPER_ADMIN, ADMIN, HR, FINANCE]}>
                <EmployeesPage />
              </RoleGate>
            }
          />
          <Route
            path="employees/new"
            element={
              <RoleGate roles={[SUPER_ADMIN, ADMIN, HR]}>
                <EmployeeFormPage />
              </RoleGate>
            }
          />
          <Route
            path="employees/:id"
            element={
              <RoleGate roles={[SUPER_ADMIN, ADMIN, HR, FINANCE]}>
                <EmployeeDetailPage />
              </RoleGate>
            }
          />
          <Route
            path="employees/:id/edit"
            element={
              <RoleGate roles={[SUPER_ADMIN, ADMIN, HR]}>
                <EmployeeFormPage />
              </RoleGate>
            }
          />
          <Route path="profile" element={<ProfilePage />} />

          <Route
            path="organization"
            element={
              <RoleGate roles={[SUPER_ADMIN, ADMIN, HR]}>
                <OrganizationPage />
              </RoleGate>
            }
          />
          <Route
            path="users"
            element={
              <RoleGate roles={[SUPER_ADMIN, ADMIN]}>
                <UsersPage />
              </RoleGate>
            }
          />
          <Route
            path="onboarding"
            element={
              <RoleGate roles={[SUPER_ADMIN, ADMIN, HR]}>
                <OnboardingPage />
              </RoleGate>
            }
          />

          <Route path="attendance/my" element={<MyAttendancePage />} />
          <Route
            path="attendance/records"
            element={
              <RoleGate roles={[SUPER_ADMIN, ADMIN, HR]}>
                <AttendanceRecordsPage />
              </RoleGate>
            }
          />
          <Route
            path="attendance/corrections"
            element={
              <RoleGate roles={[SUPER_ADMIN, ADMIN, HR, EMPLOYEE]}>
                <CorrectionsPage />
              </RoleGate>
            }
          />
          <Route
            path="attendance/shifts"
            element={
              <RoleGate roles={[SUPER_ADMIN, ADMIN]}>
                <ShiftsPage />
              </RoleGate>
            }
          />
          <Route path="attendance/holidays" element={<HolidaysPage />} />

          <Route path="leave/my" element={<MyLeavePage />} />
          <Route
            path="leave/approvals"
            element={
              <RoleGate roles={[SUPER_ADMIN, ADMIN, HR]}>
                <LeaveApprovalsPage />
              </RoleGate>
            }
          />
          <Route path="leave/calendar" element={<LeaveCalendarPage />} />
          <Route path="wfh" element={<WfhPage />} />
          <Route path="helpdesk" element={<HelpdeskPage />} />
          <Route path="exit" element={<ExitPage />} />

          <Route path="performance/reports" element={<MyReportsPage />} />
          <Route path="performance/reports/new" element={<ReportEditorPage />} />
          <Route path="performance/reports/:id/edit" element={<ReportEditorPage />} />
          <Route path="performance/reports/:id" element={<ReportDetailPage />} />
          <Route path="performance/goals" element={<GoalsPage />} />

          <Route
            path="finance/reviews"
            element={
              <RoleGate roles={[SUPER_ADMIN, FINANCE]}>
                <FinanceReviewsPage />
              </RoleGate>
            }
          />
          <Route
            path="finance/reimbursements"
            element={
              <RoleGate roles={[SUPER_ADMIN, FINANCE]}>
                <ReimbursementsPage />
              </RoleGate>
            }
          />
          <Route
            path="hr/reviews"
            element={
              <RoleGate roles={[SUPER_ADMIN, HR]}>
                <HrReviewsPage />
              </RoleGate>
            }
          />

          <Route
            path="payroll"
            element={
              <RoleGate roles={[SUPER_ADMIN, FINANCE]}>
                <PayrollPage />
              </RoleGate>
            }
          />
          <Route
            path="payroll/salary-structures"
            element={
              <RoleGate roles={[SUPER_ADMIN, FINANCE, HR]}>
                <SalaryStructuresPage />
              </RoleGate>
            }
          />
          <Route path="payroll/my" element={<MyPayslipsPage />} />

          <Route
            path="recruitment"
            element={
              <RoleGate roles={[SUPER_ADMIN, ADMIN, HR]}>
                <RecruitmentPage />
              </RoleGate>
            }
          />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route
            path="settings"
            element={
              <RoleGate roles={[SUPER_ADMIN]}>
                <SettingsPage />
              </RoleGate>
            }
          />
          <Route
            path="audit-logs"
            element={
              <RoleGate roles={[SUPER_ADMIN]}>
                <AuditLogsPage />
              </RoleGate>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
