import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import cn from '../../utils/cn';

const tones = {
  info: { wrap: 'border-sky-200/70 bg-sky-50/80 text-sky-900', icon: Info },
  success: { wrap: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-900', icon: CheckCircle2 },
  warning: { wrap: 'border-amber-200/70 bg-amber-50/80 text-amber-900', icon: AlertTriangle },
  error: { wrap: 'border-rose-200/70 bg-rose-50/80 text-rose-900', icon: XCircle },
};

const Alert = ({ tone = 'info', title, children, className }) => {
  const config = tones[tone] || tones.info;
  const Icon = config.icon;
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm shadow-inset backdrop-blur', config.wrap, className)}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5')}>{children}</div> : null}
      </div>
    </div>
  );
};

export default Alert;
