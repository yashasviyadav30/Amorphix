"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { passwordProblem, startSession } from "@/components/account/session";
import { ok } from "@/components/fx/sfx";

// The link in a "reset your password" email opens here with a short-lived session; the person picks a new password
// and is signed straight in.
export default function ResetPassword() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser()
      .auth.getSession()
      .then(({ data }) => setReady(!!data.session));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const weak = passwordProblem(password);
    if (weak) return setError(weak);
    setBusy(true);
    setError(null);
    const auth = supabaseBrowser().auth;
    const { error } = await auth.updateUser({ password });
    if (error) {
      setBusy(false);
      return setError(/different from the old/i.test(error.message) ? "Pick a password you haven't used here before." : error.message);
    }
    ok();
    const { data } = await auth.getSession();
    setError(data.session ? await startSession(data.session.access_token, "/home") : "Password saved. Please sign in.");
    setBusy(false);
  }

  return (
    <main className="grid flex-1 place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="text-xs uppercase tracking-[0.25em] text-accent">Reset your password</p>
        <h1 className="mt-2 font-serif text-4xl">Pick a new password</h1>
        {ready === false ? (
          <div className="mt-6">
            <p className="text-ink-soft">That reset link has expired or was already used.</p>
            <a href="/login" className="glow-btn mt-6 inline-block rounded-full px-6 py-3">
              Back to sign in
            </a>
          </div>
        ) : (
          <form onSubmit={save} className="mt-8 grid gap-2.5">
            <label htmlFor="password" className="text-sm text-ink-soft">
              New password
            </label>
            <input id="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-full border border-line bg-paper-raised px-5 py-3 outline-none transition focus:border-accent" />
            <p className="px-2 text-xs text-ink-soft">At least 8 characters, with a letter and a number.</p>
            <button type="submit" disabled={busy || !ready} className="glow-btn mt-2 rounded-full px-5 py-3 disabled:opacity-60">
              {busy ? "Saving…" : "Save and sign in"}
            </button>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
