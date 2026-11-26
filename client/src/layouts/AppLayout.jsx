import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  ShieldCheck,
  User as UserIcon,
  CheckCheck,
  X,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import useAuth from '../hooks/useAuth';
import { navigationForRole } from '../utils/navigation';
import { ROLE_LABELS } from '../utils/constants';
import { relativeTime } from '../utils/format';
import Avatar from '../components/ui/Avatar';
import ToastContainer from '../components/ui/ToastContainer';
import { notificationService } from '../services/notification.service';
import { setSidebar, setUnreadNotifications } from '../store/uiSlice';
import { easeLiquid } from '../components/ui/motion';
import cn from '../utils/cn';

const AppLayout = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const dispatch = useDispatch();
  const { sidebarOpen, unreadNotifications } = useSelector((state) => state.ui);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  const sections = navigationForRole(role);
  const activeItem = sections
    .flatMap((section) => section.items)
    .find((item) => location.pathname.startsWith(item.to));

  useEffect(() => {
    dispatch(setSidebar(false));
    setProfileOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname, dispatch]);

  useEffect(() => {
    let cancelled = false;
    const loadCount = async () => {
      try {
        const data = await notificationService.unreadCount();
        if (!cancelled) dispatch(setUnreadNotifications(data.unread || 0));
      } catch {
        /* ignore polling errors */
      }
    };
    loadCount();
    const interval = setInterval(loadCount, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [dispatch]);

  useEffect(() => {
    const handleClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target)) setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const openNotifications = async () => {
    setNotificationsOpen((open) => !open);
    if (!notificationsOpen) {
      try {
        const data = await notificationService.list({ limit: 8 });
        setNotifications(data.items || []);
        dispatch(setUnreadNotifications(data.unread || 0));
      } catch {
        setNotifications([]);
      }
    }
  };

  const markAllRead = async () => {
    await notificationService.markAllRead();
    setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
    dispatch(setUnreadNotifications(0));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-navy-700 focus:shadow-glass"
      >
        Skip to content
      </a>

      <div className="app-orb -left-24 top-[-7rem] h-80 w-80 bg-aqua-300/40 animate-float" aria-hidden="true" />
      <div className="app-orb right-[-7rem] top-16 h-[26rem] w-[26rem] bg-lavender-300/35 animate-float-slow" aria-hidden="true" />
      <div className="app-orb bottom-[-9rem] left-1/4 h-[28rem] w-[28rem] bg-peach-200/40 animate-float" aria-hidden="true" />
      <div className="app-orb right-1/4 top-1/3 h-64 w-64 bg-mint-200/35 animate-drift" aria-hidden="true" />

      <ToastContainer />

      <AnimatePresence>
        {sidebarOpen ? (
          <motion.div
            className="fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => dispatch(setSidebar(false))}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed inset-y-3 left-3 z-40 flex w-[272px] flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/70 shadow-glass backdrop-blur-2xl transition-transform duration-300 ease-liquid lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-[112%]',
        )}
      >
        <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-lavender-200/60 blur-2xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-10 top-1/3 h-32 w-32 rounded-full bg-aqua-200/50 blur-2xl" aria-hidden="true" />

        <div className="relative flex h-[74px] items-center justify-between border-b border-white/80 px-4">
          <Link to="/dashboard" className="group flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow transition group-hover:scale-105">
              <ShieldCheck size={20} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-sm font-semibold leading-tight text-slate-900">Northwind HRMS</span>
              <span className="block text-[11px] text-slate-500">People operations suite</span>
            </span>
          </Link>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-800 lg:hidden"
            onClick={() => dispatch(setSidebar(false))}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="relative flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.section}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{section.section}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} className="nav-link">
                      {({ isActive }) => (
                        <>
                          {isActive ? (
                            <motion.span
                              layoutId="sidebar-active-pill"
                              className="absolute inset-0 rounded-xl border border-white bg-white shadow-glass"
                              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                              aria-hidden="true"
                            />
                          ) : null}
                          <span className={cn('relative flex w-full items-center gap-3', isActive && 'font-semibold text-slate-900')}>
                            <Icon size={16} className={cn('shrink-0 transition', isActive ? 'text-navy-600' : 'text-slate-400')} />
                            <span className="truncate">{item.label}</span>
                            {isActive ? (
                              <motion.span
                                layoutId="sidebar-active-dot"
                                className="ml-auto h-1.5 w-1.5 rounded-full bg-gradient-to-br from-aqua-400 to-violet-500"
                                aria-hidden="true"
                              />
                            ) : null}
                          </span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative border-t border-white/80 p-3">
          <div className="mb-2 overflow-hidden rounded-2xl bg-gradient-to-br from-aqua-100/90 via-lavender-100/80 to-blush-100/80 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-600">
              <Sparkles size={12} /> Liquid workspace
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
              Attendance, leave, payroll and people records in one flow.
            </p>
          </div>
          <Link to="/profile" className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white/80">
            <Avatar name={user?.name} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-800">{user?.name}</span>
              <span className="block text-[11px] text-slate-500">{ROLE_LABELS[role]}</span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="lg:pl-[288px]">
        <header className="sticky top-0 z-20 px-3 pt-3 sm:px-5">
          <div className="glass-panel flex h-16 items-center justify-between gap-3 rounded-2xl border-white/80 bg-white/70 px-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="btn-icon border border-white bg-white/80 text-slate-600 lg:hidden"
                onClick={() => dispatch(setSidebar(true))}
                aria-label="Open navigation"
              >
                <Menu size={18} />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {activeItem ? 'Workspace' : 'Northwind'}
                </p>
                <p className="truncate font-display text-sm font-semibold text-slate-800">
                  {location.pathname === '/profile' ? 'Profile' : activeItem?.label || 'Dashboard'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5">
              <motion.div className="relative" ref={notificationRef}>
                <button
                  type="button"
                  onClick={openNotifications}
                  className="btn-icon border border-white bg-white/80 text-slate-500 hover:text-slate-800"
                  aria-label="Notifications"
                >
                  <Bell size={17} />
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-br from-coral-400 to-blush-500 px-1 text-[10px] font-bold text-white shadow">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  ) : null}
                </button>
                <AnimatePresence>
                  {notificationsOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: easeLiquid }}
                      className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-white/90 bg-white/90 shadow-lift backdrop-blur-2xl"
                    >
                      <div className="flex items-center justify-between border-b border-white/80 bg-gradient-to-r from-aqua-50/80 to-lavender-50/80 px-4 py-3">
                        <p className="font-display text-sm font-semibold text-slate-800">Notifications</p>
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="flex items-center gap-1 text-xs font-medium text-navy-700 hover:underline"
                        >
                          <CheckCheck size={13} /> Mark all read
                        </button>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length ? (
                          notifications.map((item) => (
                            <Link
                              key={item._id}
                              to={item.link || '/notifications'}
                              className={cn(
                                'block border-b border-white/60 px-4 py-3 transition hover:bg-aqua-50/50',
                                !item.isRead && 'bg-lavender-50/60',
                              )}
                            >
                              <p className="text-sm font-medium text-slate-800">{item.title}</p>
                              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.message}</p>
                              <p className="mt-1 text-[11px] text-slate-400">{relativeTime(item.createdAt)}</p>
                            </Link>
                          ))
                        ) : (
                          <p className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet.</p>
                        )}
                      </div>
                      <Link
                        to="/notifications"
                        className="block border-t border-white/80 px-4 py-2.5 text-center text-xs font-semibold text-navy-700 hover:bg-white/70"
                      >
                        View all notifications
                      </Link>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>

              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-xl border border-white bg-white/80 py-1.5 pl-1.5 pr-2 shadow-inset transition hover:bg-white"
                  aria-label="Account menu"
                >
                  <Avatar name={user?.name} size="sm" />
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-[130px] truncate text-xs font-semibold text-slate-800">{user?.name}</span>
                    <span className="block text-[11px] text-slate-500">{ROLE_LABELS[role]}</span>
                  </span>
                  <ChevronDown size={14} className={cn('text-slate-400 transition', profileOpen && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {profileOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: easeLiquid }}
                      className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-white/90 bg-white/90 shadow-lift backdrop-blur-2xl"
                    >
                      <div className="border-b border-white/80 bg-gradient-to-r from-lavender-50/80 to-blush-50/70 px-4 py-3">
                        <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
                        <p className="truncate text-xs text-slate-500">{user?.email}</p>
                      </div>
                      <Link to="/profile" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-white/80">
                        <UserIcon size={15} /> My profile
                      </Link>
                      <Link
                        to="/profile?tab=security"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-white/80"
                      >
                        <KeyRound size={15} /> Password & sessions
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 border-t border-white/80 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50/80"
                      >
                        <LogOut size={15} /> Sign out
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <main id="main-content" className="page-container">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.26, ease: easeLiquid }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="px-6 py-5 text-center text-[11px] text-slate-400">
          Northwind HRMS &middot; Liquid people operations platform
        </footer>
      </div>
    </div>
  );
};

export default AppLayout;
