import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Home,
  Layers,
  Minus,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import LandingNav from './LandingNav';
import DashboardMockup from './DashboardMockup';
import { easeLiquid, Reveal, Stagger, StaggerItem } from '../../components/ui/motion';
import { benefits, challenges, faqs, lifecycle, modules, showcaseScreens } from './landingData';
import useAuth from '../../hooks/useAuth';
import cn from '../../utils/cn';
import './landing.css';

const SectionHeading = ({ eyebrow, title, description, align = 'center', className }) => (
  <div className={cn('max-w-2xl', align === 'center' ? 'mx-auto text-center' : 'text-left', className)}>
    <p className="landing-eyebrow">
      <Sparkles size={12} /> {eyebrow}
    </p>
    <h2 className="landing-h2 mt-3">{title}</h2>
    {description ? <p className="landing-lead mt-4">{description}</p> : null}
  </div>
);

const ScrollProgress = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 130, damping: 28, restDelta: 0.001 });
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-aqua-400 via-indigo-500 to-blush-400"
      aria-hidden="true"
    />
  );
};

const Hero = () => {
  const reduce = useReducedMotion();
  return (
    <section className="relative overflow-hidden pb-10 pt-28 sm:pt-32" aria-labelledby="hero-title">
      <div className="pointer-events-none absolute inset-0 landing-grid" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-aqua-200/50 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-20 top-0 h-80 w-80 rounded-full bg-lavender-200/55 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-peach-200/40 blur-3xl" aria-hidden="true" />

      <div className="landing-container relative">
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            className="chip mx-auto border-white bg-white/85 text-[11px] text-slate-600 shadow-soft"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeLiquid }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-mint-400 to-emerald-500" />
            Enterprise HRMS · Self-hosted · Role-aware
          </motion.p>

          <motion.h1
            id="hero-title"
            className="mt-5 font-display text-[clamp(2.4rem,6.2vw,4.6rem)] font-semibold leading-[1.03] tracking-[-0.035em] text-slate-900"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.05, ease: easeLiquid }}
          >
            People first.
            <br />
            <span className="bg-gradient-to-r from-aqua-500 via-indigo-500 to-lavender-500 bg-clip-text text-transparent">
              Operations simplified.
            </span>
          </motion.h1>

          <motion.p
            className="landing-lead mx-auto mt-5 max-w-2xl text-balance"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.14, ease: easeLiquid }}
          >
            Everything your organization needs to manage people, streamline HR operations and build a more productive
            workplace — all in one intelligent platform.
          </motion.p>

          <motion.div
            className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.22, ease: easeLiquid }}
          >
            <a href="#platform" className="btn btn-primary w-full px-5 py-2.5 sm:w-auto">
              Explore the platform <ArrowRight size={16} />
            </a>
            <Link to="/login" className="btn btn-secondary w-full px-5 py-2.5 sm:w-auto">
              Get started <ArrowUpRight size={16} />
            </Link>
          </motion.div>

          <motion.ul
            className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-slate-500"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            {['Role-based access control', 'Audit trail on every action', 'Works on desktop and mobile'].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check size={12} className="text-mint-500" /> {item}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          className="relative mx-auto mt-10 max-w-4xl sm:mt-12"
          initial={reduce ? false : { opacity: 0, y: 34, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: easeLiquid }}
          style={{ perspective: 1200 }}
        >
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-aqua-200/45 via-lavender-200/40 to-peach-200/40 blur-2xl" aria-hidden="true" />
          <DashboardMockup className="scale-[0.98] sm:scale-100" />

          <motion.div
            className="absolute -left-3 top-16 hidden rounded-2xl border border-white bg-white/90 p-2.5 shadow-lift backdrop-blur sm:block"
            animate={reduce ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mint-100 text-emerald-600">
                <Home size={14} />
              </span>
              <div>
                <p className="text-[10px] font-semibold text-slate-800">WFH approved</p>
                <p className="text-[9px] text-slate-500">Attendance marked automatically</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="absolute -right-2 bottom-20 hidden rounded-2xl border border-white bg-white/90 p-2.5 shadow-lift backdrop-blur sm:block"
            animate={reduce ? undefined : { y: [0, 9, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sun-100 text-amber-600">
                <Wallet size={14} />
              </span>
              <div>
                <p className="text-[10px] font-semibold text-slate-800">Payroll verified</p>
                <p className="text-[9px] text-slate-500">Finance → HR approval chain</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <p className="mt-4 text-center text-[10px] text-slate-400">
          Product preview built from the live application · sample data
        </p>
      </div>
    </section>
  );
};

const ChallengeSection = () => (
  <section className="landing-section" aria-labelledby="challenge-title">
    <div className="landing-container grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <Reveal>
        <p className="landing-eyebrow">
          <Minus size={12} /> The everyday reality
        </p>
        <h2 id="challenge-title" className="landing-h2 mt-3">
          HR shouldn&apos;t be complicated.
        </h2>
        <p className="landing-lead mt-4">
          Most teams don&apos;t struggle because people are hard to manage. They struggle because the information lives
          in six places and every approval needs a reminder.
        </p>
        <div className="mt-6 rounded-2xl border border-white/90 bg-white/70 p-4 shadow-inset backdrop-blur">
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <X size={16} className="mt-0.5 shrink-0 text-coral-500" />
            Every disconnected tool is another version of the truth to reconcile at month end.
          </p>
        </div>
      </Reveal>

      <Stagger className="grid gap-3 sm:grid-cols-2">
        {challenges.map((item, index) => (
          <StaggerItem key={item}>
            <div className="group flex h-full items-start gap-3 rounded-2xl border border-white/90 bg-white/70 p-4 shadow-inset backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-glass">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400 transition group-hover:from-coral-100 group-hover:text-coral-500">
                <X size={15} />
              </span>
              <p className="text-sm leading-relaxed text-slate-700">{item}</p>
              <span className="ml-auto text-[10px] font-semibold text-slate-300">0{index + 1}</span>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  </section>
);

const platformChips = [
  { label: 'Recruitment', icon: Users, tone: 'text-lavender-600 bg-lavender-50' },
  { label: 'Attendance', icon: Clock, tone: 'text-aqua-600 bg-aqua-50' },
  { label: 'Leave', icon: CalendarDays, tone: 'text-mint-600 bg-mint-50' },
  { label: 'WFH', icon: Home, tone: 'text-sky-600 bg-sky-50' },
  { label: 'Payroll', icon: Wallet, tone: 'text-peach-600 bg-peach-50' },
  { label: 'Helpdesk', icon: ShieldCheck, tone: 'text-blush-600 bg-blush-50' },
];

const PlatformSection = () => (
  <section id="platform" className="landing-section" aria-labelledby="platform-title">
    <div className="landing-container">
      <SectionHeading
        eyebrow="The transformation"
        title="One platform. Every people operation."
        description="Instead of moving data between tools, each workflow writes to the same employee record — and every approval leaves a trail."
      />

      <Reveal className="mt-10">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-white/90 bg-white/60 p-6 shadow-glass backdrop-blur-2xl sm:p-10">
          <div className="pointer-events-none absolute -left-10 top-0 h-48 w-48 rounded-full bg-aqua-200/50 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-10 bottom-0 h-52 w-52 rounded-full bg-lavender-200/50 blur-3xl" aria-hidden="true" />
          <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-2.5">
              {platformChips.slice(0, 3).map((chip) => {
                const Icon = chip.icon;
                return (
                  <div key={chip.label} className={`flex items-center gap-2.5 rounded-xl border border-white bg-white/85 px-3 py-2 shadow-inset ${chip.tone}`}>
                    <Icon size={15} />
                    <span className="text-xs font-semibold">{chip.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
              <span className="absolute inset-0 rounded-full border border-dashed border-indigo-200" aria-hidden="true" />
              <span className="absolute inset-5 rounded-full border border-white bg-gradient-to-br from-aqua-100 via-lavender-100 to-blush-100 shadow-glass" aria-hidden="true" />
              <div className="relative text-center">
                <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
                  <Layers size={18} />
                </span>
                <p className="mt-1.5 font-display text-[11px] font-semibold text-slate-800">Northwind</p>
                <p className="text-[9px] text-slate-500">One record</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {platformChips.slice(3).map((chip) => {
                const Icon = chip.icon;
                return (
                  <div key={chip.label} className={`flex items-center gap-2.5 rounded-xl border border-white bg-white/85 px-3 py-2 shadow-inset md:flex-row-reverse md:text-right ${chip.tone}`}>
                    <Icon size={15} />
                    <span className="text-xs font-semibold">{chip.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Reveal>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ['One record', 'Attendance, leave, remote days and payroll read the same employee data.'],
          ['One approval chain', 'Requests move from manager to HR automatically, with policy limits.'],
          ['One audit trail', 'Every create, update and approval is recorded with actor and time.'],
        ].map(([title, copy]) => (
          <Reveal key={title}>
            <div className="rounded-2xl border border-white/90 bg-white/65 p-4 shadow-inset backdrop-blur">
              <p className="landing-h3 text-sm">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{copy}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

const LifecycleSection = () => {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 55%'] });
  const progress = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <section id="lifecycle" className="landing-section" aria-labelledby="lifecycle-title">
      <div className="landing-container grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="landing-eyebrow">
            <Users size={12} /> The employee lifecycle
          </p>
          <h2 id="lifecycle-title" className="landing-h2 mt-3">
            Every journey. One connected experience.
          </h2>
          <p className="landing-lead mt-4">
            From the first interview to the final relieving letter, hand-offs stop being lost in inboxes. The same record
            follows the person through every stage.
          </p>
          <Link to="/login" className="btn btn-primary mt-6">
            See it in the app <ArrowRight size={16} />
          </Link>
        </div>

        <div ref={ref} className="relative">
          <div className="absolute left-[19px] top-2 hidden h-[calc(100%-1rem)] w-[2px] rounded-full bg-slate-200/80 sm:block" aria-hidden="true" />
          {!reduce ? (
            <motion.div
              className="absolute left-[19px] top-2 hidden w-[2px] origin-top rounded-full bg-gradient-to-b from-aqua-400 via-indigo-400 to-blush-400 sm:block"
              style={{ height: progress }}
              aria-hidden="true"
            />
          ) : null}

          <ol className="space-y-3">
            {lifecycle.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title}>
                  <Reveal delay={index * 0.03}>
                    <div className="flex gap-3 sm:gap-5">
                      <span className="relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white bg-white/90 text-navy-600 shadow-glass">
                        <Icon size={17} />
                      </span>
                      <div className="flex-1 rounded-2xl border border-white/90 bg-white/70 p-4 shadow-inset backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-glass">
                        <div className="flex items-center justify-between gap-2">
                          <p className="landing-h3 text-sm">{step.title}</p>
                          <span className="text-[10px] font-semibold text-slate-300">0{index + 1}</span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{step.copy}</p>
                      </div>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
};

const PreviewSection = () => {
  const [screen, setScreen] = useState('dashboard');
  const reduce = useReducedMotion();

  return (
    <section id="preview" className="landing-section" aria-labelledby="preview-title">
      <div className="landing-container">
        <SectionHeading
          eyebrow="Product tour"
          title="Your entire workforce. At a glance."
          description="Switch between the screens your team uses every day. Each one is modelled on the running application — sign in to use the real thing."
        />

        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/90 bg-white/70 p-1.5 shadow-inset backdrop-blur" role="tablist" aria-label="Product screens">
          {showcaseScreens.map((item) => {
            const active = screen === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="preview-panel"
                id={`preview-tab-${item.key}`}
                onClick={() => setScreen(item.key)}
                className={cn(
                  'relative rounded-xl px-3 py-1.5 text-xs font-semibold transition sm:text-sm',
                  active ? 'text-white' : 'text-slate-600 hover:bg-white hover:text-slate-900',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="preview-tab-pill"
                    className="absolute inset-0 rounded-xl bg-brand-gradient shadow-glow"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative mx-auto mt-8 max-w-4xl">
          <div className="absolute -inset-6 -z-10 rounded-[2.2rem] bg-gradient-to-br from-aqua-200/40 via-lavender-200/40 to-peach-200/40 blur-2xl" aria-hidden="true" />
          <div
            id="preview-panel"
            role="tabpanel"
            aria-labelledby={`preview-tab-${screen}`}
            className="relative"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={screen}
                initial={reduce ? false : { opacity: 0, y: 10, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.995 }}
                transition={{ duration: 0.25, ease: easeLiquid }}
              >
                <DashboardMockup screen={screen} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

const ModulesSection = () => (
  <section id="modules" className="landing-section" aria-labelledby="modules-title">
    <div className="landing-container">
      <SectionHeading
        eyebrow="The ecosystem"
        title="Everything HR needs. Nothing scattered."
        description="Sixteen modules built into the same application. No add-ons, no separate logins, no duplicated employee records."
      />

      <Stagger className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <StaggerItem key={module.title}>
              <Link
                to={module.to}
                className={cn(
                  'landing-shine group flex h-full flex-col rounded-2xl border border-white/90 bg-gradient-to-br p-4 shadow-inset transition duration-300 hover:-translate-y-1 hover:shadow-glass focus-visible:-translate-y-1',
                  module.tint,
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-navy-600 shadow-inset ring-1 ring-white transition group-hover:rotate-3 group-hover:scale-105">
                  <Icon size={18} />
                </span>
                <p className="mt-3 font-display text-sm font-semibold text-slate-800">{module.title}</p>
                <p className="mt-1 flex-1 text-[11px] leading-relaxed text-slate-600/90">{module.description}</p>
                <span className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-slate-500 transition group-hover:text-navy-700">
                  Sign in to explore <ArrowUpRight size={11} />
                </span>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      <p className="mx-auto mt-6 max-w-2xl text-center text-[11px] text-slate-400">
        Also on the roadmap, not yet available: learning programmes, OKR cycles and biometric device ingestion.
      </p>
    </div>
  </section>
);

const ExperienceSection = () => (
  <section className="landing-section" aria-labelledby="experience-title">
    <div className="landing-container grid items-center gap-10 lg:grid-cols-2">
      <Reveal>
        <p className="landing-eyebrow">
          <Zap size={12} /> Employee experience
        </p>
        <h2 id="experience-title" className="landing-h2 mt-3">
          Better experiences for every employee.
        </h2>
        <p className="landing-lead mt-4">
          People stop chasing HR for routine answers. Requests, records and payslips live in one place, on any device.
        </p>
        <ul className="mt-6 space-y-2.5">
          {[
            'Apply for leave and remote work with a visible approval status',
            'Check in, take breaks and review monthly attendance',
            'Download payslips as soon as payroll is approved',
            'Raise a helpdesk ticket instead of an email thread',
            'See announcements, goals and personal documents',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-100 text-emerald-600">
                <Check size={12} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </Reveal>

      <div className="relative">
        <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-mint-100/60 via-white to-lavender-100/60 blur-xl" aria-hidden="true" />
        <Reveal y={24}>
          <div className="rounded-2xl border border-white/90 bg-white/55 p-3 shadow-glass backdrop-blur sm:rotate-[-1.2deg]">
            <DashboardMockup screen="leave" compact />
          </div>
        </Reveal>
        <Reveal delay={0.12} y={28}>
          <div className="ml-auto mt-[-1.5rem] w-[86%] rounded-2xl border border-white/90 bg-white/55 p-3 shadow-lift backdrop-blur sm:rotate-[1.4deg]">
            <DashboardMockup screen="attendance" compact />
          </div>
        </Reveal>
        <p className="mt-3 text-right text-[10px] text-slate-400">Illustrative previews of employee self-service</p>
      </div>
    </div>
  </section>
);

const WhySection = () => (
  <section id="why" className="landing-section" aria-labelledby="why-title">
    <div className="landing-container">
      <SectionHeading
        eyebrow="Why teams choose it"
        title="Built for the work behind the work."
        description="Not another dashboard to maintain — the operating layer for people data, approvals and records."
      />

      <Stagger className="mt-10 grid gap-3 sm:grid-cols-2">
        {benefits.map((benefit, index) => (
          <StaggerItem key={benefit.title}>
            <div className={cn('h-full rounded-2xl border border-white/90 bg-gradient-to-br p-5 shadow-inset transition duration-300 hover:-translate-y-0.5 hover:shadow-glass', benefit.tone)}>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">0{index + 1}</span>
              <p className="landing-h3 mt-2">{benefit.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{benefit.copy}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="mt-8">
        <div className="rounded-2xl border border-white/90 bg-white/70 p-5 shadow-inset backdrop-blur">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Runs on a transparent, auditable stack
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {['React', 'Node.js', 'Express', 'MongoDB', 'JWT sessions', 'Role permissions', 'Audit log'].map((item) => (
              <span key={item} className="rounded-full border border-white bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-inset">
                {item}
              </span>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400">
            No certifications or compliance claims are made beyond what the application implements.
          </p>
        </div>
      </Reveal>
    </div>
  </section>
);

const FaqSection = () => {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="landing-section" aria-labelledby="faq-title">
      <div className="landing-container grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div>
          <p className="landing-eyebrow">
            <Sparkles size={12} /> Questions
          </p>
          <h2 id="faq-title" className="landing-h2 mt-3">
            Straight answers.
          </h2>
          <p className="landing-lead mt-4">
            Still unsure whether it fits your process? Sign in with a demo account and explore the modules directly.
          </p>
          <Link to="/login" className="btn btn-secondary mt-5">
            Open the application <ArrowUpRight size={15} />
          </Link>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, index) => {
            const isOpen = open === index;
            return (
              <div key={faq.q} className="overflow-hidden rounded-2xl border border-white/90 bg-white/70 shadow-inset backdrop-blur">
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${index}`}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                  >
                    <span className="text-sm font-semibold text-slate-800">{faq.q}</span>
                    <ChevronDown size={16} className={cn('shrink-0 text-slate-400 transition duration-300', isOpen && 'rotate-180 text-navy-500')} />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      id={`faq-panel-${index}`}
                      role="region"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: easeLiquid }}
                    >
                      <p className="px-4 pb-4 text-sm leading-relaxed text-slate-600">{faq.a}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const FinalCta = () => {
  const { isAuthenticated } = useAuth();
  return (
    <section className="landing-section pb-10" aria-labelledby="cta-title">
      <div className="landing-container">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/90 bg-white/70 p-7 text-center shadow-glass backdrop-blur-2xl sm:p-12">
            <div className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-aqua-200/60 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -right-10 bottom-0 h-60 w-60 rounded-full bg-blush-200/60 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-sun-200/50 blur-3xl" aria-hidden="true" />

            <div className="relative">
              <p className="landing-eyebrow justify-center">
                <Sparkles size={12} /> Ready when you are
              </p>
              <h2 id="cta-title" className="landing-h2 mx-auto mt-3 max-w-2xl">
                Build a better workplace starting today.
              </h2>
              <p className="landing-lead mx-auto mt-4 max-w-xl">
                Bring attendance, leave, remote work, payroll and performance into one platform your team can actually
                trust.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                <Link to="/login" className="btn btn-primary w-full px-5 py-2.5 sm:w-auto">
                  Get started <ArrowRight size={16} />
                </Link>
                <a href="#modules" className="btn btn-secondary w-full px-5 py-2.5 sm:w-auto">
                  Explore modules
                </a>
              </div>
              <p className="mt-4 text-[11px] text-slate-400">
                {isAuthenticated ? 'You are signed in — continue from your dashboard.' : 'Use your company account to sign in.'}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

const LandingFooter = () => (
  <footer className="border-t border-white/80 bg-white/50 py-10 backdrop-blur">
    <div className="landing-container grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
            <ShieldCheck size={18} />
          </span>
          <span className="font-display text-sm font-semibold text-slate-900">Northwind HRMS</span>
        </Link>
        <p className="mt-3 max-w-xs text-xs leading-relaxed text-slate-500">
          An enterprise people-operations platform covering the employee lifecycle, attendance, leave, payroll and
          performance in one system.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Product</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li><a href="#platform" className="hover:text-navy-700">Platform</a></li>
          <li><a href="#preview" className="hover:text-navy-700">Product tour</a></li>
          <li><a href="#lifecycle" className="hover:text-navy-700">Employee lifecycle</a></li>
          <li><a href="#why" className="hover:text-navy-700">Why choose it</a></li>
        </ul>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Modules</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li><a href="#modules" className="hover:text-navy-700">People & attendance</a></li>
          <li><a href="#modules" className="hover:text-navy-700">Payroll & expenses</a></li>
          <li><a href="#modules" className="hover:text-navy-700">Recruitment & onboarding</a></li>
          <li><a href="#modules" className="hover:text-navy-700">Helpdesk & assets</a></li>
        </ul>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Access</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li><Link to="/login" className="hover:text-navy-700">Sign in</Link></li>
          <li><Link to="/forgot-password" className="hover:text-navy-700">Reset password</Link></li>
          <li><Link to="/privacy" className="hover:text-navy-700">Privacy policy</Link></li>
          <li><Link to="/terms" className="hover:text-navy-700">Terms of use</Link></li>
        </ul>
      </div>
    </div>

    <div className="landing-container mt-8 flex flex-col items-center justify-between gap-2 border-t border-white/80 pt-5 text-[11px] text-slate-400 sm:flex-row">
      <p>&copy; {new Date().getFullYear()} Northwind HRMS. Internal people-operations platform.</p>
      <p>Attendance · Leave · Remote · Payroll · Performance</p>
    </div>
  </footer>
);

const LandingPage = () => {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Northwind HRMS — People First. Operations Simplified.';
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content');
    if (description) {
      description.setAttribute(
        'content',
        'Northwind HRMS is an enterprise people-operations platform for employee records, attendance, leave, work from home, payroll, recruitment, performance and offboarding.',
      );
    }
    return () => {
      document.title = previous;
      if (description && previousDescription) description.setAttribute('content', previousDescription);
    };
  }, []);

  return (
    <div className="landing-root relative min-h-screen overflow-x-hidden">
      <ScrollProgress />
      <LandingNav />
      <main id="main-content">
        <Hero />
        <ChallengeSection />
        <PlatformSection />
        <LifecycleSection />
        <PreviewSection />
        <ModulesSection />
        <ExperienceSection />
        <WhySection />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
