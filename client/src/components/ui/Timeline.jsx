import { motion, useReducedMotion } from 'framer-motion';
import { Check, Circle, X } from 'lucide-react';
import cn from '../../utils/cn';
import { easeLiquid } from './motion';

const stateStyles = {
  done: 'bg-grad-mint text-emerald-900 ring-mint-200',
  current: 'bg-brand-gradient text-white ring-navy-200 shadow-glow',
  pending: 'bg-white/80 text-slate-400 ring-white',
  rejected: 'bg-gradient-to-br from-rose-400 to-red-500 text-white ring-rose-200',
};

const dotIcon = {
  done: Check,
  current: Circle,
  pending: Circle,
  rejected: X,
};

const Timeline = ({ items = [], className, compact = false }) => {
  const reduce = useReducedMotion();
  return (
    <ol className={cn('relative space-y-0', className)}>
      {items.map((item, index) => {
        const state = item.state || 'pending';
        const Icon = item.icon || dotIcon[state];
        const isLast = index === items.length - 1;
        return (
          <motion.li
            key={item.key || item.title || index}
            className="relative flex gap-3 pb-5 last:pb-0"
            initial={reduce ? false : { opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, delay: index * 0.05, ease: easeLiquid }}
          >
            <div className="relative flex flex-col items-center">
              <span
                className={cn(
                  'relative z-10 flex items-center justify-center rounded-full ring-1 transition',
                  compact ? 'h-7 w-7' : 'h-9 w-9',
                  stateStyles[state],
                )}
              >
                <Icon size={compact ? 12 : 15} strokeWidth={2.4} />
              </span>
              {!isLast ? (
                <span
                  className={cn(
                    'mt-1 w-px flex-1 rounded-full',
                    state === 'done' ? 'bg-gradient-to-b from-mint-300 to-mint-100' : 'bg-slate-200/80',
                  )}
                />
              ) : null}
            </div>
            <div className={cn('min-w-0 pt-1', compact && 'pt-0.5')}>
              <p className={cn('font-medium text-slate-800', compact ? 'text-xs' : 'text-sm')}>{item.title}</p>
              {item.description ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.description}</p> : null}
              {item.meta ? <p className="mt-1 text-[11px] text-slate-400">{item.meta}</p> : null}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
};

export default Timeline;
