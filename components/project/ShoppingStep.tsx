"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { marketOf, money, TIER_NAMES, TIERS, type Tier } from "@/lib/budget/costs";
import { tick } from "@/components/fx/sfx";
import type { Shopping } from "@/lib/shop/fetch";
import type { BrandInfo } from "@/lib/shop/list";
import { CountUp, HudCard, Reveal, Scanning } from "@/components/fx/Motion";
import { mapsLink } from "./GreenAndTime";

// The shopping list: every piece in the design, a brand in their taste that makes it, a cheaper and a dearer
// alternative, a rough price at their tier, and furniture stores near the site ranked for their taste.

const dollars = (b: BrandInfo) => (b.level ? "$".repeat(b.level) : "");
const why = (b: BrandInfo) => (b.loved ? "you love it" : b.via.length ? `matched to ${b.via.slice(0, 2).join(" and ")}` : "matched to your taste");

/** Where a brand's link goes: its store in their city (checked), else its official Instagram, else nowhere. */
const linkOf = (b: BrandInfo) =>
  b.store
    ? { href: mapsLink(b.store.name, b.store.address), says: `Store near you: ${b.store.name.split("|")[0].trim()}` }
    : b.instagram
      ? { href: `https://www.instagram.com/${encodeURIComponent(b.instagram)}/`, says: "Not sold near you · see their work on Instagram" }
      : null;

function BrandLink({ b, className, children }: { b: BrandInfo; className: string; children: React.ReactNode }) {
  const l = linkOf(b);
  return l ? (
    <a href={l.href} target="_blank" rel="noopener noreferrer" className={className} title={l.says}>
      {children}
    </a>
  ) : (
    <span className={className} title="Not sold near you">
      {children}
    </span>
  );
}

export function ShoppingStep({ id, location, tier, onTier }: { id: string; location: string | null | undefined; tier: Tier | null; onTier: (t: Tier) => void }) {
  const [list, setList] = useState<Shopping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const still = useReducedMotion();
  useEffect(() => {
    let live = true;
    setBusy(true);
    fetch(`/api/projects/${id}/shopping${tier ? `?tier=${tier}` : ""}`)
      .then(async (r) => {
        const b = await r.json();
        if (!live) return;
        if (r.ok) setList(b);
        else setError(b.error ?? "Couldn't build the list.");
      })
      .catch(() => live && setError("Couldn't build the list. Check your connection."))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [id, tier]);
  const active = tier ?? list?.tier ?? "mid";

  const market = marketOf(location);
  const fmt = (v: number) => money(v, market);
  const total = (list?.lines ?? []).reduce((a, l) => a + l.each * l.qty, 0);
  const pieces = (list?.lines ?? []).reduce((a, l) => a + l.qty, 0);
  const find = (name: string) => mapsLink(name, location ?? "");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-2">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ink-soft">Shopping list · {list ? `${TIER_NAMES[list.tier]} · ${market.currency}` : "matching"}</p>
      </Reveal>
      {!list && !error && (
        <div className="mt-6 max-w-lg space-y-2">
          <Scanning label="Matching every piece to brands in your taste" />
          <Scanning label="Looking up cheaper and dearer alternatives" />
        </div>
      )}
      {error && <p className="mt-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>}
      {list && (
        <>
          <h1 className="mt-3 font-serif text-5xl sm:text-6xl" aria-label={`About ${fmt(total)} for ${pieces} pieces`}>
            About <CountUp value={total} format={fmt} sound />
          </h1>
          <div role="radiogroup" aria-label="Quality tier" className="mt-5 flex flex-wrap items-center gap-2">
            {TIERS.map((t) => (
              <motion.button
                key={t}
                role="radio"
                aria-checked={active === t}
                onClick={() => {
                  tick();
                  onTier(t);
                }}
                whileTap={still ? undefined : { scale: 0.94 }}
                className={`relative rounded-full border px-4 py-1.5 text-sm transition-colors ${active === t ? "border-btn text-btn-ink" : "border-line hover:border-accent"}`}
              >
                {active === t && <motion.span layoutId="shop-tier-pill" className="absolute inset-0 rounded-full bg-btn" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span className="relative">{TIER_NAMES[t]}</span>
              </motion.button>
            ))}
            {busy && <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">re-matching brands…</span>}
          </div>
          <p className="mt-3 max-w-2xl text-ink-soft">
            {pieces} pieces to furnish the design, each from a brand in your taste that makes it, at {TIER_NAMES[list.tier].toLowerCase()} prices. Rough retail
            prices; the budget&apos;s furniture line covers the same pieces.
          </p>

          <ul className={`mt-8 grid gap-4 transition-opacity md:grid-cols-2 ${busy ? "opacity-50" : ""}`}>
            {list.lines.map((l, i) => (
              <li key={l.piece}>
                <HudCard className="h-full p-5" delay={(i % 2) * 0.06}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {l.qty > 1 && <span className="text-ink-soft">{l.qty} × </span>}
                        {l.label}
                      </p>
                      <p className="text-xs text-ink-soft">{l.rooms.join(", ")}</p>
                    </div>
                    <p className="text-right tabular-nums">
                      {fmt(l.each * l.qty)}
                      {l.qty > 1 && <span className="block text-xs text-ink-soft">{fmt(l.each)} each</span>}
                    </p>
                  </div>
                  {l.brand ? (
                    <BrandLink b={l.brand} className="group mt-4 flex items-center gap-3 rounded-xl border border-line p-2 transition-colors hover:border-accent">
                      {l.brand.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Qloo's image host
                        <img src={l.brand.image} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain" loading="lazy" />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-lg bg-paper font-serif">{l.brand.name[0]}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium group-hover:underline">
                          {l.brand.name} <span className="text-ink-soft">{dollars(l.brand)}</span>
                        </span>
                        <span className="block text-xs text-ink-soft">
                          {why(l.brand)} · {linkOf(l.brand)?.says ?? "not sold near you"}
                          {linkOf(l.brand) ? " ↗" : ""}
                        </span>
                      </span>
                    </BrandLink>
                  ) : (
                    <a href={find(l.piece.includes("plant") ? "plant nursery" : `${l.label} shop`)} target="_blank" rel="noopener noreferrer" className="mt-4 block rounded-xl border border-dashed border-line p-2 text-sm text-ink-soft hover:border-accent">
                      {l.piece.includes("plant") ? "Plant nurseries near you ↗" : `No brand in your taste makes this: ${l.label.toLowerCase()} shops near you ↗`}
                    </a>
                  )}
                  {(l.cheaper || l.dearer) && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {l.cheaper && (
                        <BrandLink b={l.cheaper} className="rounded-full border border-line px-3 py-1 transition hover:-translate-y-0.5 hover:border-leaf">
                          Spend less: {l.cheaper.name} <span className="text-ink-soft">{dollars(l.cheaper)}</span>
                          {l.cheaper.store && <span className="text-leaf"> · near you</span>}
                        </BrandLink>
                      )}
                      {l.dearer && (
                        <BrandLink b={l.dearer} className="rounded-full border border-line px-3 py-1 transition hover:-translate-y-0.5 hover:border-accent">
                          Spend more: {l.dearer.name} <span className="text-ink-soft">{dollars(l.dearer)}</span>
                          {l.dearer.store && <span className="text-leaf"> · near you</span>}
                        </BrandLink>
                      )}
                    </div>
                  )}
                </HudCard>
              </li>
            ))}
          </ul>

          {list.stores.length > 0 && (
            <HudCard className="mt-8 p-5">
              <h2 className="font-serif text-2xl">Furniture stores near you</h2>
              <p className="text-xs text-ink-soft">Ranked for your taste.</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {list.stores.map((s) => (
                  <li key={s.name + s.address}>
                    <a href={mapsLink(s.name, s.address)} target="_blank" rel="noopener noreferrer" className="group -m-1 block rounded-lg p-1 hover:bg-paper">
                      <span className="font-medium group-hover:underline">{s.name.split("|")[0].trim()}</span>
                      {s.address && <p className="text-sm text-ink-soft">{s.address}</p>}
                      <span className="text-xs text-leaf">Open in Google Maps ↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </HudCard>
          )}
        </>
      )}
    </main>
  );
}
