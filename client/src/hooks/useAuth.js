import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../store/authSlice';

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, permissions, employeeProfile, status, initialized } = useSelector((state) => state.auth);
  const role = user?.role;

  const hasRole = useCallback((...roles) => roles.flat().includes(role), [role]);
  const hasPermission = useCallback((permission) => permissions.includes(permission), [permissions]);
  const logout = useCallback(() => dispatch(logoutUser()), [dispatch]);

  return {
    user,
    role,
    permissions,
    employeeProfile,
    status,
    initialized,
    isAuthenticated: Boolean(user),
    hasRole,
    hasPermission,
    logout,
  };
};

export default useAuth;
