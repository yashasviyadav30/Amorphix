"use client";

import { useState } from "react";
import { tick } from "@/components/fx/sfx";

// The last thing on the account page: delete the account, in red, behind typing DELETE.
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: word }) }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      return setError((await res?.json().catch(() => null))?.error ?? "Couldn't delete your account. Please try again.");
    }
    window.location.assign("/");
  }

  return (
    <section className="mx-auto mt-6 w-full max-w-2xl rounded-2xl border border-red-500/40 bg-red-500/5 p-5">
      <p className="text-xs uppercase tracking-widest text-red-600">Danger zone</p>
      <p className="mt-1 font-serif text-2xl">Delete my account</p>
      <p className="mt-1 text-sm text-ink-soft">
        Deletes your account, your profile and every project you own, with their threads, files and sites. Projects others shared with you stay with them. This can&apos;t be undone.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            tick();
            setOpen(true);
          }}
          className="mt-4 rounded-full border border-red-600 px-5 py-2 text-sm text-red-600 transition hover:bg-red-600 hover:text-white"
        >
          Delete my account
        </button>
      ) : (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void remove();
          }}
        >
          <label className="sr-only" htmlFor="confirm-delete">
            Type DELETE to confirm
          </label>
          <input
            id="confirm-delete"
            autoFocus
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Type DELETE"
            autoComplete="off"
            className="w-40 rounded-full border border-red-500/50 bg-paper-raised px-4 py-2 text-sm outline-none focus:border-red-600"
          />
          <button type="submit" disabled={word !== "DELETE" || busy} className="rounded-full bg-red-600 px-5 py-2 text-sm text-white transition hover:bg-red-700 disabled:opacity-40">
            {busy ? "Deleting…" : "Delete for good"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-ink-soft hover:text-ink">
            Cancel
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      )}
    </section>
  );
}
