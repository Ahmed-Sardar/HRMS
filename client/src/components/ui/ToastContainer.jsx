import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { dismissToast } from '../../store/uiSlice';

const toneMap = {
  success: { icon: CheckCircle2, className: 'text-emerald-600' },
  error: { icon: XCircle, className: 'text-red-600' },
  warning: { icon: AlertTriangle, className: 'text-amber-600' },
  info: { icon: Info, className: 'text-blue-600' },
};

const Toast = ({ toast }) => {
  const dispatch = useDispatch();
  const { icon: Icon, className } = toneMap[toast.type] || toneMap.info;

  useEffect(() => {
    const timer = setTimeout(() => dispatch(dismissToast(toast.id)), 4500);
    return () => clearTimeout(timer);
  }, [dispatch, toast.id]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24 }}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg"
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${className}`} />
      <div className="flex-1 text-sm">
        {toast.title ? <p className="font-semibold text-slate-800">{toast.title}</p> : null}
        <p className={toast.title ? 'text-slate-600' : 'text-slate-700'}>{toast.message}</p>
      </div>
      <button type="button" onClick={() => dispatch(dismissToast(toast.id))} className="text-slate-400 hover:text-slate-600">
        <X size={14} />
      </button>
    </motion.div>
  );
};

const ToastContainer = () => {
  const toasts = useSelector((state) => state.ui.toasts);
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
