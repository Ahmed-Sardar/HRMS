import cn from '../../utils/cn';

export const Spinner = ({ size = 20, className }) => (
  <span
    className={cn('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className)}
    style={{ width: size, height: size }}
    aria-label="Loading"
  />
);

export const PageLoader = ({ label = 'Loading workspace...' }) => (
  <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-slate-500">
    <Spinner size={28} className="text-navy-800" />
    <p className="text-sm">{label}</p>
  </div>
);

export const Skeleton = ({ className }) => <div className={cn('animate-pulse rounded bg-slate-200', className)} />;

export const FullScreenLoader = () => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eef1fb]">
    <div className="app-orb -left-20 top-10 h-72 w-72 bg-navy-400/30 blur-3xl" aria-hidden="true" />
    <div className="app-orb bottom-0 right-0 h-80 w-80 bg-aurora-300/25 blur-3xl" aria-hidden="true" />
    <div className="glass-panel relative flex flex-col items-center gap-3 px-10 py-8">
      <Spinner size={30} className="text-navy-600" />
      <p className="font-display text-sm font-medium text-slate-700">Loading workspace...</p>
    </div>
  </div>
);

export default Spinner;
