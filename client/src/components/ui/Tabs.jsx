import cn from '../../utils/cn';

const Tabs = ({ items, value, onChange, className }) => (
  <div className={cn('inline-flex flex-wrap items-center gap-1 rounded-xl border border-white/70 bg-white/55 p-1 shadow-inset backdrop-blur', className)}>
    {items.map((item) => {
      const active = value === item.key;
      return (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition',
            active
              ? 'bg-brand-gradient text-white shadow-glow'
              : 'text-slate-600 hover:bg-white/70 hover:text-slate-900',
          )}
        >
          {item.label}
          {item.count !== undefined && item.count !== null ? (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                active ? 'bg-white/25 text-white' : 'bg-white/70 text-slate-600',
              )}
            >
              {item.count}
            </span>
          ) : null}
        </button>
      );
    })}
  </div>
);

export default Tabs;
