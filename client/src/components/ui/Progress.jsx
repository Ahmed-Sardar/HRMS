import { motion, useReducedMotion } from 'framer-motion';
import cn from '../../utils/cn';
import { easeLiquid } from './motion';

const tones = {
  aqua: 'from-aqua-300 to-sky-400',
  indigo: 'from-indigo-400 to-violet-500',
  mint: 'from-mint-300 to-emerald-400',
  pista: 'from-pista-300 to-lime-400',
  peach: 'from-peach-300 to-orange-400',
  coral: 'from-coral-300 to-rose-400',
  blush: 'from-blush-300 to-pink-400',
  sun: 'from-sun-200 to-amber-400',
  slate: 'from-slate-300 to-slate-400',
};

export const ProgressBar = ({ value = 0, tone = 'indigo', size = 'md', className, label }) => {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  const height = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-2.5' : 'h-2';
  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>{label}</span>
          <span className="font-semibold text-slate-700">{Math.round(safe)}%</span>
        </div>
      ) : null}
      <div className={cn('overflow-hidden rounded-full bg-white/70 shadow-inset ring-1 ring-white/70', height)}>
        <motion.div
          className={cn('h-full rounded-full bg-gradient-to-r', tones[tone] || tones.indigo)}
          initial={{ width: 0 }}
          whileInView={{ width: `${safe}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: easeLiquid }}
        />
      </div>
    </div>
  );
};

export const ProgressRing = ({ value = 0, size = 96, stroke = 9, tone = 'indigo', children, className }) => {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  const reduce = useReducedMotion();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gradientId = `ring-${tone}`;
  const gradients = {
    indigo: ['#818cf8', '#a855f7'],
    aqua: ['#3ccbe0', '#6366f1'],
    mint: ['#3fd3a4', '#34d399'],
    peach: ['#ffa95c', '#fb7185'],
  };
  const [from, to] = gradients[tone] || gradients.indigo;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: circumference - (safe / 100) * circumference }}
          viewport={{ once: true }}
          transition={{ duration: reduce ? 0 : 1.1, ease: easeLiquid }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
};

export default ProgressBar;
