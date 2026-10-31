"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Scanning } from "@/components/fx/Motion";
import { startSession } from "@/components/account/session";

// Where the email link, Google and Apple send people back. The Supabase session in the URL is swapped for our own
// signed cookie, then the person carries on (new accounts first pick their role).
export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const failed = hash.get("error_description") ?? url.searchParams.get("error_description");
    (async () => {
      if (failed) return setError(failed.includes("expired") ? "That sign-in link has expired." : failed);
      const { data } = await supabaseBrowser().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return setError("We couldn't sign you in from that link.");
      setError(await startSession(token, url.searchParams.get("next") ?? "/home"));
    })();
  }, []);

  return (
    <main className="grid flex-1 place-items-center px-4">
      {error ? (
        <div className="text-center">
          <p className="font-serif text-3xl">Let&apos;s try that again</p>
          <p className="mt-2 text-ink-soft">{error}</p>
          <a href="/login" className="glow-btn mt-6 inline-block rounded-full px-6 py-3">
            Back to sign in
          </a>
        </div>
      ) : (
        <Scanning label="Signing you in" />
      )}
    </main>
  );
}
