import cn from '../../utils/cn';

export const Card = ({ children, className, interactive = false, ...rest }) => (
  <section className={cn('glass-card', interactive && 'glass-card-hover', className)} {...rest}>
    {children}
  </section>
);

export const CardHeader = ({ title, description, actions, icon: Icon, accent = 'from-sky-400 via-indigo-400 to-violet-400', className }) => (
  <header className={cn('relative flex flex-wrap items-center justify-between gap-3 border-b border-white/70 px-5 py-4', className)}>
    <div className="flex min-w-0 items-center gap-3">
      {Icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-navy-600 shadow-inset ring-1 ring-white">
          <Icon size={17} />
        </span>
      ) : (
        <span className={cn('h-8 w-1 shrink-0 rounded-full bg-gradient-to-b', accent)} aria-hidden="true" />
      )}
      <div className="min-w-0">
        <h2 className="section-title truncate">{title}</h2>
        {description ? <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{description}</p> : null}
      </div>
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </header>
);

export const CardBody = ({ children, className }) => <div className={cn('p-5', className)}>{children}</div>;

export default Card;
