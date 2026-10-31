"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import QRCode from "qrcode";
import { ok, tick, transition } from "@/components/fx/sfx";

const TYPES = [
  ["house", "House"],
  ["apartment", "Apartment"],
  ["studio", "Studio"],
  ["cafe", "Café or restaurant"],
  ["office", "Office"],
  ["shop", "Shop or showroom"],
  ["hotel", "Hotel"],
] as const;

// "+ New client" for architects and builders: who the client is, then answer the questions together now, or send
// the client a link (and a QR code) so they answer at home.
export function NewClient({ className = "glow-btn rounded-full px-5 py-2.5 text-sm", label = "+ New client" }: { className?: string; label?: ReactNode } = {}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          tick();
          setOpen(true);
        }}
        title="New client"
        className={className}
      >
        {label}
      </button>
      {typeof document !== "undefined" && createPortal(<AnimatePresence>{open && <Form onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
    </>
  );
}

function Form({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("house");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState<"now" | "link" | null>(null);
  const [sent, setSent] = useState<{ id: string; url: string; qr: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(how: "now" | "link") {
    if (!name.trim() || !city.trim()) return setError("Add the client's name and city.");
    tick();
    setBusy(how);
    setError(null);
    const res = await fetch("/api/clients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, spaceType: type, city, link: how === "link" }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(null);
      return setError(body.error ?? "Couldn't start the project.");
    }
    if (how === "now") {
      transition();
      return window.location.assign(`/start?project=${body.id}`);
    }
    const url = `${window.location.origin}/join/${body.token}`;
    setSent({ id: body.id, url, qr: await QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: "#0e1a2b", light: "#ffffff" } }) });
    setBusy(null);
    ok();
  }

  const input = "w-full rounded-xl border border-line bg-paper px-4 py-2.5 outline-none transition focus:border-accent";
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-label="New client"
        className="w-full max-w-md rounded-3xl border border-line bg-paper-raised p-6 shadow-2xl"
        initial={{ y: 16, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-accent">New client</p>
            <h2 className="mt-1 font-serif text-3xl">{sent ? `Send ${name.split(" ")[0]} this link` : "Who is it for?"}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-paper">
            ✕
          </button>
        </div>

        {sent ? (
          <div className="mt-5 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sent.qr} alt="QR code for the client's link" className="mx-auto h-44 w-44 rounded-xl border border-line bg-white p-2" />
            <p className="mt-2 text-sm text-ink-soft">They sign up, answer Let&apos;s get to know you at home, and their design lands in your projects.</p>
            <div className="mt-3 flex gap-2">
              <input readOnly value={sent.url} onFocus={(e) => e.target.select()} aria-label="Client's link" className="min-w-0 flex-1 rounded-full border border-line bg-paper px-3 py-2 text-xs" />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(sent.url).catch(() => {});
                  tick();
                  setCopied(true);
                }}
                className="glow-btn rounded-full px-4 py-2 text-sm"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <a href={`/project/${sent.id}`} className="mt-4 inline-block text-sm text-accent hover:underline">
              Open the project
            </a>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm">
              Client&apos;s name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={input} placeholder="Maya Chen" autoFocus />
            </label>
            <label className="grid gap-1.5 text-sm">
              What are you designing?
              <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
                {TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className={input} placeholder="Austin, Brooklyn, London…" />
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button onClick={() => create("now")} disabled={!!busy} className="glow-btn rounded-full px-4 py-3 text-sm disabled:opacity-60">
                {busy === "now" ? "Starting…" : "Fill it in together now"}
              </button>
              <button onClick={() => create("link")} disabled={!!busy} className="rounded-full border border-line px-4 py-3 text-sm transition hover:border-accent hover:text-accent disabled:opacity-60">
                {busy === "link" ? "Making the link…" : "Send them a link"}
              </button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
