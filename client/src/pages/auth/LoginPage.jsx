import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ShieldCheck,
  Lock,
  Mail,
  Users,
  CalendarClock,
  Wallet,
  ArrowRight,
  Sparkles,
  Home,
  LifeBuoy,
} from 'lucide-react';
import { loginUser, clearError } from '../../store/authSlice';
import { Input } from '../../components/ui/Field';
import Alert from '../../components/ui/Alert';
import { easeLiquid } from '../../components/ui/motion';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const demoAccounts = [
  { label: 'Super Admin', email: 'superadmin@hrms.com' },
  { label: 'Admin', email: 'admin@hrms.com' },
  { label: 'HR', email: 'hr@hrms.com' },
  { label: 'Finance', email: 'finance@hrms.com' },
  { label: 'Employee', email: 'employee@hrms.com' },
];

const features = [
  { icon: CalendarClock, title: 'Attendance & breaks', copy: 'Check-in, multi-break tracking and policy-driven working hours.', tint: 'from-aqua-200/80 to-sky-200/70' },
  { icon: Users, title: 'People operations', copy: 'Employee records, onboarding, documents and company assets.', tint: 'from-lavender-200/80 to-violet-200/70' },
  { icon: Wallet, title: 'Payroll & performance', copy: 'Finance verification, HR review and payslip generation.', tint: 'from-peach-200/80 to-coral-200/70' },
  { icon: Home, title: 'Hybrid working', copy: 'Work-from-home approvals tied to attendance and payroll.', tint: 'from-mint-200/80 to-pista-200/70' },
];

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const reduce = useReducedMotion();
  const { status, error } = useSelector((state) => state.auth);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const onSubmit = async (values) => {
    const result = await dispatch(loginUser(values));
    if (loginUser.fulfilled.match(result)) {
      const from = location.state?.from || '/dashboard';
      navigate(from, { replace: true });
    }
  };

  const fillAccount = (email) => {
    setValue('email', email);
    setValue('password', 'Admin@12345');
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -left-24 top-[-8rem] h-[26rem] w-[26rem] rounded-full bg-aqua-200/60 blur-3xl animate-float" />
        <div className="absolute right-[-6rem] top-10 h-[22rem] w-[22rem] rounded-full bg-lavender-200/70 blur-3xl animate-float-slow" />
        <div className="absolute bottom-[-10rem] left-1/3 h-[24rem] w-[24rem] rounded-full bg-peach-200/60 blur-3xl animate-float" />
        <div className="absolute left-10 top-1/2 h-56 w-56 rounded-full bg-mint-200/50 blur-3xl animate-drift" />
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-stretch gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.section
          className="relative hidden flex-col justify-between overflow-hidden rounded-[2rem] border border-white/80 bg-white/55 p-9 shadow-glass backdrop-blur-2xl lg:flex"
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeLiquid }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-sheen opacity-70" aria-hidden="true" />

          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
              <ShieldCheck size={23} />
            </span>
            <div>
              <p className="font-display text-base font-semibold leading-tight text-slate-900">Northwind HRMS</p>
              <p className="text-xs text-slate-500">Human Resource Management System</p>
            </div>
          </div>

          <div className="relative mt-8 max-w-lg">
            <span className="chip border-white bg-white/80 text-[11px] font-semibold text-navy-600">
              <Sparkles size={12} className="text-lavender-500" /> Liquid people operations
            </span>
            <h1 className="mt-4 font-display text-[34px] font-semibold leading-[1.15] tracking-tight text-slate-900 text-balance">
              One beautiful workspace for your <span className="text-gradient">entire employee journey</span>.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Hiring, onboarding, attendance, leave, hybrid work, performance, payroll and offboarding — connected, permission-aware
              and audit-ready.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    className="rounded-2xl border border-white/90 bg-white/70 p-3.5 shadow-inset backdrop-blur"
                    initial={reduce ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.15 + index * 0.07, ease: easeLiquid }}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${feature.tint} text-navy-700`}>
                      <Icon size={16} />
                    </span>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{feature.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{feature.copy}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="relative mt-8 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <LifeBuoy size={13} className="text-aqua-500" /> HR helpdesk
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />
            <span>JWT sessions &middot; role-based access &middot; audit trail</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />
            <span>&copy; {new Date().getFullYear()} Northwind Technologies</span>
          </div>
        </motion.section>

        <motion.main
          className="flex flex-col justify-center"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: easeLiquid }}
        >
          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
                <ShieldCheck size={20} />
              </span>
              <div>
                <p className="font-display text-base font-semibold text-slate-900">Northwind HRMS</p>
                <p className="text-[11px] text-slate-500">People operations suite</p>
              </div>
            </div>

            <div className="glass-card p-6 sm:p-7">
              <p className="eyebrow text-navy-500">Welcome back</p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900">Sign in to your workspace</h2>
              <p className="mt-1 text-sm text-slate-500">Use your company email address and password.</p>

              {searchParams.get('expired') ? (
                <Alert tone="warning" className="mt-4">
                  Your session expired. Please sign in again.
                </Alert>
              ) : null}

              {error ? (
                <Alert tone="error" className="mt-4">
                  {typeof error === 'string' ? error : 'Unable to sign in'}
                </Alert>
              ) : null}

              <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute left-3 top-[42px] text-slate-400" />
                  <Input
                    label="Work email"
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="[&_input]:pl-9"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                </div>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-3 top-[42px] text-slate-400" />
                  <Input
                    label="Password"
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="[&_input]:pl-9"
                    error={errors.password?.message}
                    {...register('password')}
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-500">Secured with JWT + refresh tokens</span>
                  <Link to="/forgot-password" className="text-xs font-semibold text-navy-700 hover:underline">
                    Forgot password?
                  </Link>
                </div>

                <button type="submit" className="btn btn-primary w-full py-2.5" disabled={status === 'loading'}>
                  {status === 'loading' ? 'Signing in...' : 'Sign in'}
                  {status !== 'loading' ? <ArrowRight size={16} /> : null}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-white/90 bg-gradient-to-br from-aqua-50/80 via-lavender-50/70 to-blush-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">Demo accounts</p>
                <p className="mt-1 text-[11px] text-slate-500">Password for all demo users: Admin@12345</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {demoAccounts.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => fillAccount(account.email)}
                      className="rounded-full border border-white bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-inset transition hover:-translate-y-px hover:text-navy-800 hover:shadow-soft"
                    >
                      {account.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] text-slate-400">
              Internal use only &middot; Need help? Raise a ticket in the HR helpdesk.
            </p>
          </div>
        </motion.main>
      </div>
    </div>
  );
};

export default LoginPage;
