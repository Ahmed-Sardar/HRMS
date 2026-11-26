import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import useAuth from '../../hooks/useAuth';
import { dashboardService } from '../../services/settings.service';
import { getErrorMessage } from '../../services/api';
import { toast } from '../../store/uiSlice';
import { PageLoader } from '../../components/ui/Loader';
import Alert from '../../components/ui/Alert';
import EmployeeDashboard from './EmployeeDashboard';
import SuperAdminDashboard from './SuperAdminDashboard';
import AdminDashboard from './AdminDashboard';
import HrDashboard from './HrDashboard';
import FinanceDashboard from './FinanceDashboard';
import { ROLES } from '../../utils/constants';

const DashboardPage = () => {
  const { role, user } = useAuth();
  const dispatch = useDispatch();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const summary = await dashboardService.summary();
      setData(summary);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      dispatch(toast(message, 'error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <PageLoader label="Preparing your dashboard..." />;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  if (data.needsProfile) {
    return (
      <Alert tone="warning" title="Employee profile missing">
        Your user account is active but has no employee profile linked. Please contact your HR administrator.
      </Alert>
    );
  }

  if (role === ROLES.SUPER_ADMIN) return <SuperAdminDashboard data={data} onRefresh={load} />;
  if (role === ROLES.ADMIN) return <AdminDashboard data={data} onRefresh={load} />;
  if (role === ROLES.HR) return <HrDashboard data={data} onRefresh={load} />;
  if (role === ROLES.FINANCE) return <FinanceDashboard data={data} onRefresh={load} />;
  return <EmployeeDashboard data={data} user={user} onRefresh={load} />;
};

export default DashboardPage;
