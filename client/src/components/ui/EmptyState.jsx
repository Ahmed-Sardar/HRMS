import { Inbox } from 'lucide-react';

const EmptyState = ({ title = 'Nothing here yet', description, action, icon: Icon = Inbox }) => (
  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
    <div className="relative mb-4 h-20 w-24">
      <span className="absolute left-0 top-2 h-14 w-14 rounded-2xl bg-grad-aqua opacity-70 blur-[1px]" aria-hidden="true" />
      <span className="absolute bottom-0 right-0 h-12 w-12 rounded-full bg-grad-blush opacity-80" aria-hidden="true" />
      <span className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/90 bg-white/85 text-navy-500 shadow-glass backdrop-blur">
        <Icon size={22} />
      </span>
    </div>
    <h3 className="font-display text-sm font-semibold text-slate-800">{title}</h3>
    {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

export default EmptyState;
