"use client";

import { motion, useReducedMotion } from "motion/react";
import { seeds, SIZE } from "@/lib/brand/seeds";

const SEEDS = seeds();

// The seed mark growing from the centre outward, the way a sunflower head fills in. Loops while `growing`.
export function AnimatedMark({ size = 160, growing = true }: { size?: number; growing?: boolean }) {
  const still = useReducedMotion();
  return (
    <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Amorphix is working">
      {SEEDS.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          className={s.accent ? "fill-accent" : "fill-ink"}
          initial={still ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={
            still
              ? undefined
              : { delay: i * 0.035, duration: 0.4, ease: "easeOut", repeat: growing ? Infinity : 0, repeatType: "reverse", repeatDelay: 1.6 }
          }
          style={{ transformOrigin: `${s.x}px ${s.y}px` }}
        />
      ))}
    </svg>
  );
}
