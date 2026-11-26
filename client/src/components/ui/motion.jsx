import { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useReducedMotion } from 'framer-motion';

export const easeLiquid = [0.16, 1, 0.3, 1];

/** Fades and slides content in when it enters the viewport (once). */
export const Reveal = ({ children, delay = 0, y = 18, className }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: easeLiquid }}
    >
      {children}
    </motion.div>
  );
};

/** Parent for staggered entrances of `<StaggerItem>` children. */
export const Stagger = ({ children, className, delay = 0, gap = 0.06 }) => (
  <motion.div
    className={className}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: '-40px' }}
    variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
  >
    {children}
  </motion.div>
);

export const StaggerItem = ({ children, className }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={
        reduce
          ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
          : {
              hidden: { opacity: 0, y: 16, scale: 0.985 },
              show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: easeLiquid } },
            }
      }
    >
      {children}
    </motion.div>
  );
};

/** Counts up to `value` once visible. Non-numeric values render unchanged. */
export const AnimatedNumber = ({ value = 0, format = (number) => Math.round(number), duration = 1.15, className }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  const reduce = useReducedMotion();
  const numeric = Number(value);
  const isNumeric = value !== null && value !== '' && Number.isFinite(numeric);
  const [display, setDisplay] = useState(isNumeric ? (reduce ? numeric : 0) : value);

  useEffect(() => {
    if (!isNumeric) {
      setDisplay(value);
      return undefined;
    }
    if (!inView) return undefined;
    if (reduce) {
      setDisplay(numeric);
      return undefined;
    }
    const controls = animate(0, numeric, {
      duration,
      ease: 'easeOut',
      onUpdate: (next) => setDisplay(next),
    });
    return () => controls.stop();
  }, [inView, numeric, isNumeric, value, duration, reduce]);

  const safeDisplay = Number.isFinite(Number(display)) ? Number(display) : numeric;
  return (
    <span ref={ref} className={className}>
      {isNumeric ? format(safeDisplay) : display}
    </span>
  );
};

/** Page-level transition wrapper used by the app layout. */
export const PageFade = ({ children, routeKey }) => (
  <motion.div
    key={routeKey}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.28, ease: easeLiquid }}
  >
    {children}
  </motion.div>
);
