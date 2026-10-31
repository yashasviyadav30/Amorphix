"use client";

import { refreshShell } from "@/components/shell/AppShell";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { tick, whoosh } from "@/components/fx/sfx";

// Deleting a project, by its owner: a small bin on the project's card, or a red link on its overview. Both ask
// first, in a dialog that says what goes with it, since it can't be undone.
export function DeleteProject({ id, name, variant }: { id: string; name: string; variant: "card" | "link" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      return setError("Couldn't delete it. Please try again.");
    }
    whoosh();
    if (variant === "link") return window.location.assign("/home");
    setOpen(false);
    router.refresh();
    refreshShell();
  }

  const show = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    tick();
    setOpen(true);
  };

  return (
    <>
      {variant === "card" ? (
        <button
          type="button"
          onClick={show}
          aria-label={`Delete ${name}`}
          title="Delete project"
          className="grid h-8 w-8 place-items-center rounded-full text-ink-soft opacity-60 transition hover:bg-red-500/10 hover:text-red-600 hover:opacity-100 focus-visible:opacity-100"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </button>
      ) : (
        <button type="button" onClick={show} className="text-sm text-red-600 hover:underline">
          Delete this project
        </button>
      )}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
                onClick={() => !busy && setOpen(false)}
              >
                <motion.div
                  role="alertdialog"
                  aria-modal
                  aria-labelledby="delete-title"
                  initial={{ y: 12, scale: 0.97 }}
                  animate={{ y: 0, scale: 1 }}
                  exit={{ y: 12, scale: 0.97 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md rounded-3xl border border-line bg-paper-raised p-6 shadow-2xl"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-red-600">&gt; delete project</p>
                  <h2 id="delete-title" className="mt-2 font-serif text-3xl">
                    Delete {name}?
                  </h2>
                  <p className="mt-2 text-sm text-ink-soft">
                    The design, its versions, the thread and its files, the team and the site go too, for everyone on it. This can&apos;t be undone.
                  </p>
                  {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                  <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-full border border-line px-5 py-2 text-sm hover:border-accent">
                      Keep it
                    </button>
                    <button type="button" onClick={() => void remove()} disabled={busy} className="rounded-full bg-red-600 px-5 py-2 text-sm text-white transition hover:bg-red-700 disabled:opacity-60">
                      {busy ? "Deleting…" : "Delete for good"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
