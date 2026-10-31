"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AnimatedMark } from "@/components/AnimatedMark";

export type VoiceState = "listening" | "thinking" | "speaking" | "idle";

const SAYS: Record<VoiceState, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Amorphix is speaking",
  idle: "Tap the orb to talk",
};

// Talking to Amorphix: the Amorphix mark on its own, large, with nothing behind it. It breathes when idle, swells with
// your voice while listening, turns while thinking and grows its seeds while speaking, with faint waves round it.
// What you say appears live under it.
export function VoiceMode({
  state,
  level,
  heard,
  reply,
  onOrb,
  onClose,
}: {
  state: VoiceState;
  level: number;
  heard: string;
  reply: string;
  onOrb: () => void;
  onClose: () => void;
}) {
  const still = useReducedMotion();
  const swell = state === "listening" ? 1 + level * 0.45 : 1;
  return (
    <motion.div
      role="dialog"
      aria-label="Talking to Amorphix"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-between overflow-hidden rounded-2xl bg-paper-raised/95 px-6 py-6 backdrop-blur"
    >
      {/* blueprint grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
      />
      <div className="relative flex w-full items-center justify-between">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-ink-soft">
          <span className={`h-2 w-2 rounded-full ${state === "listening" ? "animate-pulse bg-red-500" : "bg-accent"}`} />
          {SAYS[state]}
        </p>
        <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-accent">
          Back to typing
        </button>
      </div>

      <button type="button" onClick={onOrb} aria-label={state === "listening" ? "Stop listening" : "Talk"} className="relative grid h-64 w-64 place-items-center outline-none">
        {/* rings: your voice while listening, waves while speaking */}
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute inset-0 rounded-full border border-accent/25"
            animate={
              still
                ? {}
                : state === "speaking"
                  ? { scale: [0.6, 1.25], opacity: [0.7, 0] }
                  : state === "listening"
                    ? { scale: 0.62 + level * 0.5 + i * 0.12, opacity: 0.25 + level * 0.6 - i * 0.12 }
                    : { scale: [0.66 + i * 0.06, 0.72 + i * 0.06, 0.66 + i * 0.06], opacity: 0.25 }
            }
            transition={
              state === "speaking"
                ? { duration: 1.6, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }
                : state === "listening"
                  ? { type: "spring", stiffness: 260, damping: 18 }
                  : { duration: 3.4, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }
            }
          />
        ))}
        <motion.span
          aria-hidden
          className="relative drop-shadow-[0_0_30px_var(--accent)]"
          animate={
            still
              ? {}
              : state === "thinking"
                ? { rotate: 360, scale: 1 }
                : state === "idle"
                  ? { rotate: 0, scale: [1, 1.04, 1] }
                  : { rotate: 0, scale: swell }
          }
          transition={
            state === "thinking"
              ? { rotate: { duration: 6, repeat: Infinity, ease: "linear" } }
              : state === "idle"
                ? { scale: { duration: 3.4, repeat: Infinity, ease: "easeInOut" } }
                : { type: "spring", stiffness: 300, damping: 20 }
          }
        >
          <AnimatedMark size={150} growing={state === "thinking" || state === "speaking"} />
        </motion.span>
      </button>

      <div className="relative min-h-24 w-full max-w-xl text-center">
        <AnimatePresence mode="wait">
          {heard ? (
            <motion.p key="heard" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xl">
              {heard}
            </motion.p>
          ) : reply ? (
            <motion.p key={reply} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-lg text-ink-soft">
              {reply}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <p className="mt-3 text-xs text-ink-soft">Speak in English, हिंदी or Hinglish. Amorphix answers in yours.</p>
      </div>
    </motion.div>
  );
}
