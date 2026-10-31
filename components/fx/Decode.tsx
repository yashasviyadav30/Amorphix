"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { burst, ok } from "./sfx";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/\\[]{}";

// Text that resolves from machine noise, letter by letter, left to right.
export function Decode({ text, delay = 0, speed = 28, className = "" }: { text: string; delay?: number; speed?: number; className?: string }) {
  const still = useReducedMotion();
  const [shown, setShown] = useState(still ? text : "");

  useEffect(() => {
    if (still) {
      setShown(text);
      return;
    }
    let frame = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        frame++;
        const settled = Math.floor(frame / 2);
        if (frame === 1) burst();
        setShown(
          text
            .split("")
            .map((ch, i) => (i < settled || ch === " " ? ch : i < settled + 8 ? GLYPHS[(i * 7 + frame * 13) % GLYPHS.length] : ""))
            .join(""),
        );
        if (settled >= text.length) clearInterval(timer);
      }, speed);
    }, delay * 1000);
    return () => {
      clearTimeout(start);
      if (timer) clearInterval(timer);
    };
  }, [text, delay, speed, still]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{shown}</span>
    </span>
  );
}

// Lines that type out one after another, with a blinking cursor on the line being written.
export function TypeLog({ lines, done, className = "" }: { lines: string[]; done: boolean; className?: string }) {
  const still = useReducedMotion();
  const [count, setCount] = useState(still ? lines.length : 0);
  const [chars, setChars] = useState(0);

  useEffect(() => {
    if (still || count >= lines.length) return;
    const line = lines[count];
    if (chars < line.length) {
      const t = setTimeout(() => setChars((c) => Math.min(c + 2, line.length)), 14);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      ok();
      setCount((c) => c + 1);
      setChars(0);
    }, 260);
    return () => clearTimeout(t);
  }, [count, chars, lines, still]);

  return (
    <div className={`font-mono text-[13px] leading-6 ${className}`} role="log" aria-live="polite">
      {lines.slice(0, count).map((l, i) => (
        <div key={i} className="text-ink-soft">
          {l} <span className="text-leaf">ok</span>
        </div>
      ))}
      {count < lines.length && (
        <div className="text-ink">
          {lines[count].slice(0, chars)}
          <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-accent" />
        </div>
      )}
      {count >= lines.length && (
        <div className="text-ink">
          {done ? "> design ready" : "> working"}
          <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-accent" />
        </div>
      )}
    </div>
  );
}
