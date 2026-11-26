import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { easeLiquid } from './motion';

const PageHeader = ({ title, description, breadcrumb = [], actions, eyebrow }) => (
  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {breadcrumb.length ? (
        <nav className="mb-1.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
          {breadcrumb.map((item, index) => (
            <span key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight size={11} className="text-slate-400" /> : null}
              {item.to ? (
                <Link to={item.to} className="transition hover:text-navy-700">
                  {item.label}
                </Link>
              ) : (
                <span className="font-medium text-slate-600">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      {eyebrow ? <p className="eyebrow mb-1 text-navy-500">{eyebrow}</p> : null}
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-slate-900 sm:text-[27px]">{title}</h1>
      <motion.span
        className="mt-1.5 block h-[3px] w-14 rounded-full bg-gradient-to-r from-aqua-400 via-indigo-400 to-violet-400"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        style={{ originX: 0 }}
        transition={{ duration: 0.6, ease: easeLiquid }}
        aria-hidden="true"
      />
      {description ? <p className="mt-2 max-w-3xl text-sm text-slate-500">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export default PageHeader;
