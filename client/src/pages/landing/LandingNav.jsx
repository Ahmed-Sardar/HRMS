import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Menu, ShieldCheck, X } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { navLinks } from './landingData';
import { easeLiquid } from '../../components/ui/motion';
import cn from '../../utils/cn';

const LandingNav = () => {
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <motion.nav
        initial={reduce ? false : { opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeLiquid }}
        aria-label="Primary"
        className={cn(
          'mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 rounded-2xl border px-3 transition-all duration-300 sm:px-5',
          scrolled
            ? 'border-white/90 bg-white/85 shadow-glass backdrop-blur-2xl'
            : 'border-white/70 bg-white/60 shadow-inset backdrop-blur-xl',
        )}
      >
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Northwind HRMS home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
            <ShieldCheck size={19} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block whitespace-nowrap font-display text-[13px] font-semibold text-slate-900 sm:text-sm">Northwind HRMS</span>
            <span className="hidden text-[10px] text-slate-500 sm:block">People operations platform</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/80 hover:text-slate-900"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-primary btn-sm sm:px-3.5 sm:py-2">
              Open dashboard <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white/80 hover:text-slate-900 sm:block">
                Log in
              </Link>
              <Link to="/login" className="btn btn-primary btn-sm sm:px-3.5 sm:py-2">
                Get started <ArrowRight size={14} />
              </Link>
            </>
          )}
          <button
            type="button"
            className="btn-icon border border-white bg-white/80 text-slate-600 lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: easeLiquid }}
            className="mx-auto mt-2 max-w-6xl overflow-hidden rounded-2xl border border-white/90 bg-white/95 p-2 shadow-lift backdrop-blur-2xl lg:hidden"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-aqua-50/70"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-1 border-t border-white/80 pt-2">
              <Link to="/login" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-700 hover:bg-lavender-50/70">
                {isAuthenticated ? 'Open dashboard' : 'Log in to your workspace'}
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
};

export default LandingNav;
