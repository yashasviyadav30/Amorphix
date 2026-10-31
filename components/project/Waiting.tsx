"use client";

import { useState } from "react";
import { AnimatedMark } from "@/components/AnimatedMark";
import { Decode } from "@/components/fx/Decode";
import { ok, tick, transition } from "@/components/fx/sfx";
import { can, type ProjectRole } from "@/lib/project/access";

// A project a pro set up for a client, still waiting for Let's get to know you: answer it together now, or send
// the client their link. The client sees a single button to start answering.
export function Waiting({ id, whose, role }: { id: string; whose: string | null; role: ProjectRole }) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = whose ?? "your client";

  async function makeLink() {
    tick();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${id}/team`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "client" }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Couldn't make the link.");
    const url = `${window.location.origin}/join/${body.token}`;
    setLink(url);
    await navigator.clipboard.writeText(url).catch(() => {});
    ok();
  }

  return (
    <main className="amorphix-scan flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <AnimatedMark size={100} />
      <p className="mt-8 font-mono text-xs uppercase tracking-[0.3em] text-ink-soft">Getting to know {name.split(" ")[0]}</p>
      <h1 className="mt-3 font-serif text-4xl sm:text-5xl">
        <Decode text={role === "client" ? "Let's get to know you" : `Waiting for ${name.split(" ")[0]}'s answers`} />
      </h1>
      <p className="mt-4 max-w-md text-lg text-ink-soft">
        {role === "client"
          ? "A few questions about you, your space and what you love. Your design is made from your answers."
          : `Amorphix designs ${name.split(" ")[0]}'s space from their answers and their taste. Answer together now, or send them a link to answer at home.`}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href={`/start?project=${id}`} onClick={() => transition()} className="glow-btn rounded-full px-7 py-3">
          {role === "client" ? "Start answering" : "Fill it in together now"}
        </a>
        {can(role, "invite") && (
          <button onClick={makeLink} disabled={busy} className="rounded-full border border-line px-7 py-3 transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:opacity-60">
            {busy ? "Making the link…" : link ? "Copied ✓ Make another" : `Send ${name.split(" ")[0]} a link`}
          </button>
        )}
      </div>
      {link && (
        <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Client's link" className="mt-4 w-full max-w-md rounded-full border border-line bg-paper-raised px-4 py-2 text-center text-xs" />
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </main>
  );
}
