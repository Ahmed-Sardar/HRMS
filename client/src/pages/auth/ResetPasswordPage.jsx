import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { getErrorMessage } from '../../services/api';
import { Input } from '../../components/ui/Field';
import Alert from '../../components/ui/Alert';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters and include a number');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-800 text-white">
            <ShieldCheck size={20} />
          </span>
          <span className="text-base font-semibold text-slate-900">Northwind HRMS</span>
        </div>
        <div className="surface p-6">
          <h1 className="text-lg font-semibold text-slate-900">Choose a new password</h1>
          <p className="mt-1 text-sm text-slate-500">Use at least 8 characters with a mix of letters and numbers.</p>

          {!token ? (
            <Alert tone="error" className="mt-4">
              This reset link is invalid. Please request a new password reset email.
            </Alert>
          ) : null}
          {success ? (
            <Alert tone="success" className="mt-4">
              Password updated. Redirecting you to sign in...
            </Alert>
          ) : null}
          {error ? (
            <Alert tone="error" className="mt-4">
              {error}
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute left-3 top-[42px] text-slate-400" />
              <Input
                label="New password"
                type="password"
                required
                value={password}
                className="[&_input]:pl-9"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute left-3 top-[42px] text-slate-400" />
              <Input
                label="Confirm password"
                type="password"
                required
                value={confirm}
                className="[&_input]:pl-9"
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading || !token || success}>
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
          <Link to="/login" className="mt-4 inline-block text-sm font-medium text-navy-800 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
