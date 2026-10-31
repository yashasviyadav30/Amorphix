"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { counting, startProcessing } from "./sfx";

// Small motion pieces shared by the design screens: sections that rise into view, numbers that count up, a score
// ring that fills, bars that grow, cards with blueprint corner marks, and a scanning loader. Every piece shows its
// final state at once for people who ask for reduced motion.

/** A section that rises and sharpens into view the first time it scrolls in. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const still = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={still ? false : { opacity: 0, y: 24, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A number that counts up to `value` when it comes into view, and glides to a new value when it changes.
 * `sound`: tick along as it counts (for the one headline number on a screen, not every figure).
 */
export function CountUp({ value, format = (v) => String(Math.round(v)), duration = 1.1, sound = false }: { value: number; format?: (v: number) => string; duration?: number; sound?: boolean }) {
  const still = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const from = useRef(0);
  const [shown, setShown] = useState(still ? value : 0);
  useEffect(() => {
    if (still) return setShown(value);
    if (!seen) return;
    if (sound && from.current !== value) counting(duration * 1000);
    const c = animate(from.current, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(v) });
    from.current = value;
    return () => c.stop();
  }, [value, seen, still, duration, sound]);
  return (
    <span ref={ref} className="tabular-nums">
      {format(shown)}
    </span>
  );
}

/** A ring that fills to `value` out of 100, with the number counting up in the middle. */
export function Ring({ value, size = 88, stroke = 7 }: { value: number; size?: number; stroke?: number }) {
  const still = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(value)} out of 100`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--leaf)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={still ? false : { strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - Math.min(100, value) / 100) }}
          animate={{ strokeDashoffset: c * (1 - Math.min(100, value) / 100) }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute flex flex-col items-center leading-none text-leaf" aria-hidden>
        {/* A leaf that sways, and springs up again whenever the score changes. */}
        <motion.svg
          key={Math.round(value)}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          className="mb-0.5 origin-bottom"
          initial={still ? false : { scale: 0.3, opacity: 0 }}
          animate={still ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1, rotate: [0, -8, 6, -4, 0] }}
          transition={still ? undefined : { scale: { type: "spring", stiffness: 300, damping: 14 }, opacity: { duration: 0.3 }, rotate: { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 } }}
        >
          <path d="M5 21c0-9 6-15 15-16-1 9-7 15-15 16Z" fill="currentColor" opacity="0.9" />
          <path d="M5 21C9 15 13 11 18 7" stroke="var(--paper-raised)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </motion.svg>
        <span className="font-serif text-3xl">
          <CountUp value={value} />
        </span>
      </span>
    </div>
  );
}

/** A bar that grows from the left to `pct` (0 to 100) when it comes into view. */
export function Bar({ pct, delay = 0, className = "h-1.5 bg-btn" }: { pct: number; delay?: number; className?: string }) {
  const still = useReducedMotion();
  return (
    <motion.div
      className={`rounded-full ${className}`}
      initial={still ? false : { width: 0 }}
      whileInView={{ width: `${pct}%` }}
      animate={{ width: `${pct}%` }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

/** A card with light running along its top and bottom edges on hover, and a scan line across it when it first shows. */
export function HudCard({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const still = useReducedMotion();
  return (
    <Reveal delay={delay} className={`group relative overflow-hidden rounded-2xl border border-line bg-paper-raised transition-shadow duration-300 hover:shadow-[0_0_0_1px_var(--accent),0_12px_40px_-18px_var(--accent)] ${className}`}>
      <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-px w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 animate-[edge_2.4s_linear_infinite] motion-reduce:animate-none" />
      <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-px w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 animate-[edge-back_2.4s_linear_infinite] motion-reduce:animate-none" />
      {!still && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-accent/10 to-transparent"
          initial={{ y: "-100%" }}
          whileInView={{ y: "900%" }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, delay: delay + 0.2, ease: "easeInOut" }}
        />
      )}
      {children}
    </Reveal>
  );
}

/** A loading line: a beam sweeping across, with what is being worked on in monospace. */
// Every scan on screen shares one loading sound: it starts with the first and fades out after the last.
let scans = 0;
let stopSound: (() => void) | null = null;

export function Scanning({ label }: { label: string }) {
  const still = useReducedMotion();
  useEffect(() => {
    if (scans++ === 0) stopSound = startProcessing();
    return () => {
      if (--scans === 0) {
        stopSound?.();
        stopSound = null;
      }
    };
  }, []);
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-paper px-3 py-2" role="status">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">{label}</p>
      {!still && (
        <motion.span
          aria-hidden
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-accent/25 to-transparent"
          animate={{ x: ["-120%", "320%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}
