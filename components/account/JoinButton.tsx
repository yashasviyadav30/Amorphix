"use client";

import { useState } from "react";
import { ok } from "@/components/fx/sfx";

export function JoinButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/join/${token}`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(body.error ?? "Couldn't join. Please try again.");
    }
    ok();
    window.location.assign(body.next ?? `/project/${body.projectId}`);
  }

  return (
    <>
      <button onClick={join} disabled={busy} className="glow-btn mt-8 rounded-full px-7 py-3 disabled:opacity-60">
        {busy ? "Joining…" : "Join the project"}
      </button>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );
}
