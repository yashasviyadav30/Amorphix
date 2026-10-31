"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import { Reveal } from "@/components/fx/Motion";
import { tick } from "@/components/fx/sfx";

// The film: a real run of the app from every side, played from storage (it shows Qloo images, so it isn't in the
// repo). Muted and looping once it's in view, with a button to turn the sound on. If the film isn't there, the
// section steps aside.
const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media`;

export function Film() {
  const video = useRef<HTMLVideoElement>(null);
  const [gone, setGone] = useState(false);
  const [sound, setSound] = useState(false);
  if (gone) return null;
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    tick();
    v.muted = !v.muted;
    if (!v.muted) void v.play().catch(() => {});
    setSound(!v.muted);
  };
  return (
    <section id="film" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-20 sm:px-8">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">See it in under a minute</p>
        <h2 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">Every side of it: homeowner, café owner, architect, client and builder.</h2>
        <p className="mt-4 text-lg text-ink-soft">A real run of Amorphix on a family house in Los Angeles, from the first answer to moving in.</p>
      </Reveal>
      {/* the film as a card lifted off the page: a soft glow under it, tilted back a little until it's in view */}
      <div className="relative mx-auto mt-12 max-w-3xl [perspective:1600px]">
        <div aria-hidden className="absolute -inset-x-10 -bottom-10 top-10 rounded-[3rem] bg-accent/25 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: 14, scale: 0.94 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          whileHover={{ y: -6 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          onViewportEnter={() => void video.current?.play().catch(() => {})}
          onViewportLeave={() => video.current?.pause()}
          className="relative overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_2px_4px_rgba(0,0,0,.06),0_12px_24px_-6px_rgba(0,0,0,.12),0_48px_96px_-24px_rgba(0,0,0,.35),0_0_0_1px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
        >
          <div className="flex items-center gap-2 border-b border-line bg-paper-raised px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">amorphix · under a minute</span>
            <button
              type="button"
              onClick={toggle}
              aria-pressed={sound}
              className="ml-auto flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs transition hover:border-accent hover:text-accent"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                {sound ? <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /> : <path d="m22 9-6 6M16 9l6 6" />}
              </svg>
              {sound ? "Sound on" : "Sound off"}
            </button>
          </div>
          <video ref={video} src={`${BASE}/amorphix-film.mp4`} poster={`${BASE}/amorphix-film.jpg`} muted loop playsInline controls preload="metadata" onError={() => setGone(true)} onVolumeChange={(e) => setSound(!e.currentTarget.muted)} className="block aspect-video w-full bg-paper" aria-label="A film of Amorphix from every side: homeowner, café owner, architect, client and builder" />
        </motion.div>
      </div>
    </section>
  );
}
