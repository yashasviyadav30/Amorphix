"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Decode } from "@/components/fx/Decode";
import { Scanning } from "@/components/fx/Motion";
import { chime, ok, tick, whoosh } from "@/components/fx/sfx";
import type { Profile } from "@/lib/taste/types";

// What's your space style: a few photos of rooms and places you love, read on your own device by Amorphix's taste
// model (CLIP), then a style card: its name, the words it's made of with the photo each came from, and the brands
// closest to it. "Design your space" carries the taste into the full interview.

export const TASTE_KEY = "amorphix-photo-taste";
const MAX = 5;
type Card = { style: string; profile: Profile; photos: string[] };

export function Quiz() {
  const still = useReducedMotion();
  const [step, setStep] = useState<"start" | "photos" | "reading" | "card">("start");
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(0);
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Thumbnails for the chosen photos, freed when they change.
  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [files]);

  useEffect(() => {
    if (step !== "start") window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
  }, [step, still]);

  const add = (list: FileList | null) => {
    if (!list) return;
    tick();
    const images = [...list].filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...images].slice(0, MAX));
  };

  const read = async () => {
    whoosh();
    setStep("reading");
    setError(null);
    setLoaded(0);
    try {
      const [{ embedImages }, { profileOf }, { styleName }] = await Promise.all([
        import("@/lib/taste/clip"),
        import("@/lib/taste/profile-client"),
        import("@/lib/taste/name"),
      ]);
      const vecs = await embedImages(files, setLoaded);
      const signals = vecs.map((vector, i) => ({ source: { entityId: `photo-${i + 1}`, name: `Photo ${i + 1}`, layer: 1 as const }, vector }));
      const profile = await profileOf(signals, 6);
      setCard({ style: styleName(profile), profile, photos: urls });
      setStep("card");
      chime();
    } catch {
      setError("Couldn't read the photos on this device. Try other photos, or another browser.");
      setStep("photos");
    }
  };

  const share = async () => {
    tick();
    const text = card ? `My space style is ${card.style}, read by Amorphix from photos I love.` : "What's your space style?";
    if (navigator.share) return navigator.share({ title: "My space style", text, url: location.href }).catch(() => {});
    await navigator.clipboard?.writeText(`${text} ${location.href}`).catch(() => {});
    setCopied(true);
    ok();
    setTimeout(() => setCopied(false), 1600);
  };

  const design = () => {
    tick();
    try {
      if (card) sessionStorage.setItem(TASTE_KEY, JSON.stringify(card.profile));
    } catch {}
    location.assign("/start");
  };

  const again = () => {
    tick();
    setFiles([]);
    setCard(null);
    setStep("photos");
  };

  const words = card?.profile.tags.filter((t) => t.family !== "tone").slice(0, 8) ?? [];
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <AnimatePresence mode="wait">
        {step === "start" && (
          <motion.section key="start" initial={still ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="py-10 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Read on your device</p>
            <h1 className="mt-3 font-serif text-5xl sm:text-6xl">
              <Decode text="What's your space style?" />
            </h1>
            <p className="mx-auto mt-4 max-w-md text-lg text-ink-soft">Show Amorphix up to {MAX} photos of rooms, cafés or hotels you love. Its taste model reads the style behind them, and your photos never leave your device.</p>
            <button
              onClick={() => {
                tick();
                setStep("photos");
              }}
              className="glow-btn mt-8 px-8 py-3"
            >
              Find my style
            </button>
          </motion.section>
        )}

        {step === "photos" && (
          <motion.section key="photos" initial={still ? false : { opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-ink-soft">
              {files.length} of {MAX} photos
            </p>
            <h2 className="mt-1 font-serif text-3xl sm:text-4xl">
              <Decode text="Photos of spaces you love" />
            </h2>
            <p className="mt-2 text-ink-soft">A room you saved, a café you go back to, a hotel you never wanted to leave. Two or three is enough.</p>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {urls.map((u, i) => (
                <li key={u} className="relative overflow-hidden rounded-2xl border border-line bg-paper-raised">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local photo preview */}
                  <img src={u} alt={`Photo ${i + 1}`} className="aspect-square w-full object-cover" />
                  <button
                    onClick={() => {
                      tick();
                      setFiles(files.filter((_, k) => k !== i));
                    }}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-paper/90 text-sm shadow"
                  >
                    ×
                  </button>
                </li>
              ))}
              {files.length < MAX && (
                <li>
                  <button
                    onClick={() => input.current?.click()}
                    className="grid aspect-square w-full place-items-center rounded-2xl border border-dashed border-line text-ink-soft transition hover:border-accent hover:text-accent"
                  >
                    + Add photos
                  </button>
                </li>
              )}
            </ul>
            <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.currentTarget.files)} />
            <div className="mt-6 flex flex-wrap gap-2">
              <button disabled={!files.length} onClick={() => void read()} className="glow-btn px-6 py-2.5 disabled:opacity-40">
                Read my style
              </button>
            </div>
            {error && <p className="mt-4 text-red-600">{error}</p>}
          </motion.section>
        )}

        {step === "reading" && (
          <motion.section key="reading" initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="grid place-items-center py-24 text-center">
            <Scanning label={loaded > 0 && loaded < 1 ? `Loading the taste model · ${Math.round(loaded * 100)}%` : "Reading your taste on your device"} />
            <p className="mt-4 max-w-sm text-sm text-ink-soft">The first time, the model downloads once and stays in your browser.</p>
          </motion.section>
        )}

        {step === "card" && card && (
          <motion.section key="card" initial={still ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-xl">
            <div className="overflow-hidden rounded-3xl border border-line bg-paper-raised shadow-[0_30px_80px_-40px_var(--accent)]">
              <div className={`grid ${card.photos.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                {card.photos.slice(0, 3).map((u, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- a local photo preview
                  <img key={u} src={u} alt={`Photo ${i + 1}`} className="aspect-square w-full object-cover" />
                ))}
              </div>
              <div className="p-6">
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Your space style</p>
                <h2 className="mt-2 font-serif text-5xl">
                  <Decode text={card.style} />
                </h2>
                <p className="mt-2 text-ink-soft">Read by Amorphix&apos;s taste model from your {card.photos.length === 1 ? "photo" : `${card.photos.length} photos`}.</p>
                {words.length > 0 && (
                  <ul className="mt-5 flex flex-wrap gap-2" aria-label="The words your style is made of">
                    {words.map((w, i) => (
                      <motion.li
                        key={`${w.family}:${w.value}`}
                        initial={still ? false : { opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.3 + i * 0.07 }}
                        className="rounded-full border border-line bg-paper px-3 py-1 text-sm capitalize"
                      >
                        {w.value.replaceAll("_", " ")}
                        <span className="normal-case text-ink-soft"> · {w.sources.map((s) => s.name).join(", ")}</span>
                      </motion.li>
                    ))}
                  </ul>
                )}
                {card.profile.brands.length > 0 && <p className="mt-5 text-sm text-ink-soft">Brands closest to your taste: {card.profile.brands.map((b) => b.name).join(", ")}.</p>}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button onClick={design} className="glow-btn px-6 py-2.5">
                Design your space
              </button>
              <button onClick={() => void share()} className="rounded-full border border-line px-5 py-2.5 transition hover:border-accent hover:text-accent">
                {copied ? "Copied" : "Share my style"}
              </button>
              <button onClick={again} className="rounded-full px-5 py-2.5 text-ink-soft hover:text-ink">
                Try other photos
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
