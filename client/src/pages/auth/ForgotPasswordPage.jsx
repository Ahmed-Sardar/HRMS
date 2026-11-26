import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { getErrorMessage } from '../../services/api';
import { Input } from '../../components/ui/Field';
import Alert from '../../components/ui/Alert';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [devLink, setDevLink] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setDevLink('');
    try {
      const data = await authService.forgotPassword(email);
      setMessage('If an account exists for that email, a password reset link has been sent.');
      if (data?.resetUrl) setDevLink(data.resetUrl);
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
          <h1 className="text-lg font-semibold text-slate-900">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter your work email address and we will send a secure reset link. The link expires in 30 minutes.
          </p>

          {message ? (
            <Alert tone="success" className="mt-4">
              {message}
              {devLink ? (
                <p className="mt-2 break-all text-xs">
                  Development link: <Link to={devLink.replace(window.location.origin, '')} className="font-semibold underline">{devLink}</Link>
                </p>
              ) : null}
            </Alert>
          ) : null}
          {error ? (
            <Alert tone="error" className="mt-4">
              {error}
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="relative">
              <Mail size={16} className="pointer-events-none absolute left-3 top-[42px] text-slate-400" />
              <Input
                label="Work email"
                id="email"
                type="email"
                required
                placeholder="you@company.com"
                className="[&_input]:pl-9"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          <Link to="/login" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-navy-800 hover:underline">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
