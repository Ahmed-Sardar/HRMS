import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import { FullScreenLoader } from './ui/Loader';

export const RequireAuth = () => {
  const { isAuthenticated, initialized } = useAuth();
  const location = useLocation();

  if (!initialized) return <FullScreenLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
};

export const RoleGate = ({ roles, children }) => {
  const { hasRole } = useAuth();
  if (!roles || hasRole(...roles)) return children;
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <ShieldAlert size={22} />
      </span>
      <h2 className="text-lg font-semibold text-slate-900">Access restricted</h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Your role does not have permission to view this module. Contact your administrator if you believe this is a
        mistake.
      </p>
    </div>
  );
};

export default RequireAuth;
