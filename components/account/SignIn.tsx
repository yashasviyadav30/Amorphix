"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ok, tick } from "@/components/fx/sfx";
import { Decode } from "@/components/fx/Decode";
import { passwordProblem, startSession } from "./session";

type Provider = "google" | "apple";
type Mode = "signin" | "signup" | "forgot";

const callback = (next: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

function friendly(message: string, status?: number) {
  if (status === 429) return "Too many tries just now. Please wait a minute and try again.";
  if (/invalid login credentials/i.test(message)) return "That email and password don't match.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first. Check your inbox for our link.";
  if (/already registered/i.test(message)) return "There's already an account with this email. Sign in instead.";
  return message;
}

// Sign in or create an account: Google, Apple, or email and password. New accounts go on to pick their role.
// The sign-in providers switched on in Supabase, e.g. "google,apple". Without them only email shows.
const OAUTH = (process.env.NEXT_PUBLIC_AMORPHIX_OAUTH ?? "").split(",").map((x) => x.trim()).filter(Boolean);

export function SignIn({ next, signup }: { next: string; signup: boolean }) {
  const [mode, setMode] = useState<Mode>(signup ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [sent, setSent] = useState<null | "confirm" | "reset">(null);
  const [busy, setBusy] = useState<Provider | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const auth = () => supabaseBrowser().auth;

  async function oauth(provider: Provider) {
    tick();
    setBusy(provider);
    setError(null);
    // Ask Supabase which providers are switched on first, so a provider without keys shows a message, not an error page.
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const on = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => r.json())
      .then((s) => !!s.external?.[provider])
      .catch(() => true);
    if (!on) {
      setBusy(null);
      return setError(`${provider === "google" ? "Google" : "Apple"} sign-in opens soon. Use your email and a password for now.`);
    }
    const { error } = await auth().signInWithOAuth({ provider, options: { redirectTo: callback(next) } });
    if (error) {
      setBusy(null);
      setError(error.message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const address = email.trim();
    if (mode === "signup") {
      const weak = passwordProblem(password);
      if (weak) return setError(weak);
      // an address that can't receive mail is stopped here, before the account is made
      const check = await fetch("/api/email-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: address }) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (check?.problem) return setError(check.problem);
    }
    setBusy("email");
    if (mode === "forgot") {
      const { error } = await auth().resetPasswordForEmail(address, { redirectTo: `${window.location.origin}/auth/reset` });
      setBusy(null);
      if (error) return setError(friendly(error.message, error.status));
      ok();
      return setSent("reset");
    }
    const { data, error } =
      mode === "signup"
        ? await auth().signUp({ email: address, password, options: { emailRedirectTo: callback(next) } })
        : await auth().signInWithPassword({ email: address, password });
    if (error) {
      setBusy(null);
      return setError(friendly(error.message, error.status));
    }
    // A new account with email confirmation on has no session until the link in the email is opened.
    if (!data.session) {
      setBusy(null);
      ok();
      return setSent("confirm");
    }
    ok();
    setError(await startSession(data.session.access_token, next));
    setBusy(null);
  }

  const switchTo = (m: Mode) => {
    tick();
    setMode(m);
    setError(null);
  };
  const input = "w-full rounded-full border border-line bg-paper-raised px-5 py-3 outline-none transition focus:border-accent";

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-sm">
      <p className="text-xs uppercase tracking-[0.25em] text-accent">{mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}</p>
      <h1 className="mt-2 font-serif text-4xl">
        <Decode key={mode} text={mode === "signup" ? "Start designing with Amorphix" : mode === "forgot" ? "Forgot your password?" : "Sign in to Amorphix"} />
      </h1>
      <p className="mt-2 text-ink-soft">
        {mode === "forgot" ? "We'll email you a link to set a new one." : "Save your projects, share them, and work with your architect, client or builder."}
      </p>

      {sent ? (
        <div role="status" className="mt-8 rounded-2xl border border-line bg-paper-raised p-5">
          <p className="font-medium">Check your email</p>
          <p className="mt-1 text-sm text-ink-soft">
            {sent === "confirm" ? "We sent a link to confirm" : "We sent a link to reset the password for"} <span className="text-ink">{email}</span>.{" "}
            {sent === "confirm" ? "Open it to finish creating your account." : "Open it on this device."}
          </p>
          <button
            onClick={() => {
              setSent(null);
              setMode("signin");
            }}
            className="mt-3 text-sm text-accent hover:underline"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <>
          {mode !== "forgot" && OAUTH.length > 0 && (
            <>
              <div className="mt-8 grid gap-2.5">
                {OAUTH.includes("google") && <button onClick={() => oauth("google")} disabled={!!busy} className="flex items-center justify-center gap-3 rounded-full border border-line bg-paper-raised px-5 py-3 transition hover:border-accent disabled:opacity-60">
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
                    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.4-.4-3.5z" />
                  </svg>
                  {busy === "google" ? "Opening Google…" : "Continue with Google"}
                </button>}
                {OAUTH.includes("apple") && <button onClick={() => oauth("apple")} disabled={!!busy} className="flex items-center justify-center gap-3 rounded-full bg-btn px-5 py-3 text-btn-ink transition hover:opacity-90 disabled:opacity-60">
                  <svg width="16" height="18" viewBox="0 0 814 1000" fill="currentColor" aria-hidden>
                    <path d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-57-156-127C44 791 0 663 0 541c0-196 127-300 253-300 66 0 122 44 163 44 40 0 102-46 178-46 29 0 133 3 194 102zM555 158c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 34-146 76-28 32-55 83-55 135 0 8 1 16 2 18 3 1 9 2 14 2 45 0 102-30 134-72z" />
                  </svg>
                  {busy === "apple" ? "Opening Apple…" : "Continue with Apple"}
                </button>}
              </div>
              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-ink-soft">
                <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}
          <form onSubmit={submit} className={`grid gap-2.5 ${mode === "forgot" || !OAUTH.length ? "mt-8" : ""}`}>
            <label htmlFor="email" className="text-sm text-ink-soft">
              Email
            </label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={input} />
            {mode !== "forgot" && (
              <>
                <div className="mt-1 flex items-center justify-between">
                  <label htmlFor="password" className="text-sm text-ink-soft">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button type="button" onClick={() => switchTo("forgot")} className="text-sm text-accent hover:underline">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={show ? "text" : "password"}
                    required
                    minLength={mode === "signup" ? 8 : 1}
                    maxLength={72}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${input} pr-16`}
                  />
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-soft hover:text-ink">
                    {show ? "Hide" : "Show"}
                  </button>
                </div>
                {mode === "signup" && <p className="px-2 text-xs text-ink-soft">At least 8 characters, with a letter and a number.</p>}
              </>
            )}
            <button type="submit" disabled={!!busy} className="glow-btn mt-2 rounded-full px-5 py-3 disabled:opacity-60">
              {busy === "email" ? "One moment…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Email me a reset link" : "Sign in"}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-ink-soft">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button onClick={() => switchTo("signin")} className="text-accent hover:underline">
                  Sign in
                </button>
              </>
            ) : mode === "signin" ? (
              <>
                New to Amorphix?{" "}
                <button onClick={() => switchTo("signup")} className="text-accent hover:underline">
                  Create an account
                </button>
              </>
            ) : (
              <button onClick={() => switchTo("signin")} className="text-accent hover:underline">
                Back to sign in
              </button>
            )}
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
      <p className="mt-8 text-xs text-ink-soft">
        By continuing you agree to our{" "}
        <a href="/privacy" className="underline">
          privacy notice
        </a>
        .
      </p>
    </motion.div>
  );
}
