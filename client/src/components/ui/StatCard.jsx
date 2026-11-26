import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import cn from '../../utils/cn';
import { AnimatedNumber } from './motion';

const toneMap = {
  aqua: { tile: 'tile-aqua', icon: 'bg-white/85 text-aqua-600 ring-aqua-200', glow: 'shadow-glow-aqua' },
  lavender: { tile: 'tile-lavender', icon: 'bg-white/85 text-lavender-600 ring-lavender-200', glow: 'shadow-glow' },
  mint: { tile: 'tile-mint', icon: 'bg-white/85 text-mint-600 ring-mint-200', glow: 'shadow-glow-mint' },
  pista: { tile: 'tile-pista', icon: 'bg-white/85 text-pista-600 ring-pista-200', glow: 'shadow-soft' },
  peach: { tile: 'tile-peach', icon: 'bg-white/85 text-peach-600 ring-peach-200', glow: 'shadow-glow-peach' },
  coral: { tile: 'tile-coral', icon: 'bg-white/85 text-coral-600 ring-coral-200', glow: 'shadow-soft' },
  blush: { tile: 'tile-blush', icon: 'bg-white/85 text-blush-600 ring-blush-200', glow: 'shadow-glow-blush' },
  sun: { tile: 'tile-sun', icon: 'bg-white/85 text-amber-600 ring-sun-200', glow: 'shadow-soft' },
  sky: { tile: 'tile-sky', icon: 'bg-white/85 text-sky-600 ring-sky-200', glow: 'shadow-glow-aqua' },
  // Legacy tone names kept so existing pages keep their meaning.
  navy: { tile: 'tile-lavender', icon: 'bg-white/85 text-navy-700 ring-navy-200', glow: 'shadow-glow' },
  blue: { tile: 'tile-sky', icon: 'bg-white/85 text-sky-600 ring-sky-200', glow: 'shadow-glow-aqua' },
  indigo: { tile: 'tile-lavender', icon: 'bg-white/85 text-indigo-600 ring-indigo-200', glow: 'shadow-glow' },
  violet: { tile: 'tile-lavender', icon: 'bg-white/85 text-violet-600 ring-violet-200', glow: 'shadow-glow' },
  emerald: { tile: 'tile-mint', icon: 'bg-white/85 text-emerald-600 ring-emerald-200', glow: 'shadow-glow-mint' },
  amber: { tile: 'tile-sun', icon: 'bg-white/85 text-amber-600 ring-amber-200', glow: 'shadow-soft' },
  red: { tile: 'tile-coral', icon: 'bg-white/85 text-rose-600 ring-rose-200', glow: 'shadow-soft' },
  slate: { tile: 'tile-sky', icon: 'bg-white/85 text-slate-600 ring-slate-200', glow: 'shadow-soft' },
};

const StatCard = ({ label, value, hint, icon: Icon, tone = 'lavender', to, className, format }) => {
  const config = toneMap[tone] || toneMap.lavender;

  const content = (
    <div
      className={cn(
        'tile group flex h-full flex-col justify-between hover:-translate-y-0.5 hover:shadow-glass',
        config.tile,
        to && 'cursor-pointer',
      )}
    >
      <span className="stat-spark transition duration-500 group-hover:scale-125" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600/90">{label}</p>
        {Icon ? (
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl shadow-inset ring-1 transition duration-300 group-hover:scale-105 group-hover:rotate-3',
              config.icon,
            )}
          >
            <Icon size={17} />
          </span>
        ) : null}
      </div>
      <div className="relative mt-3">
        <p className="font-display text-[26px] font-semibold leading-tight tracking-tight text-slate-900">
          <AnimatedNumber value={value ?? 0} format={format} />
        </p>
        {hint ? <p className="mt-1 text-xs text-slate-600/80">{hint}</p> : null}
      </div>
      {to ? (
        <span className="absolute bottom-3 right-3 text-slate-500/70 opacity-0 transition group-hover:opacity-100">
          <ArrowUpRight size={15} />
        </span>
      ) : null}
    </div>
  );

  return to ? (
    <Link to={to} className={cn('block rounded-2xl focus-visible:ring-2', className)}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
};

export default StatCard;
