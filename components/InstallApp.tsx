"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import QRCode from "qrcode";
import { chime, tick } from "@/components/fx/sfx";

// "Get the app": one button in the header. On a computer it opens a small panel with both ways to have Amorphix as an
// app: install it on this computer (when the browser offers it), or scan a code to open it on the phone and add it
// to the home screen. On a phone it installs straight away where the browser allows, otherwise it shows the steps.
// Hidden inside the installed app.

type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Device = "desktop" | "ios" | "android";

export function InstallApp() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The service worker only says "you're offline" when there's no network. Production builds only, so the dev
    // server's hot reload is never served from it.
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const ua = navigator.userAgent;
    setDevice(/iphone|ipad|ipod/i.test(ua) ? "ios" : /android|mobile/i.test(ua) || !matchMedia("(pointer: fine)").matches ? "android" : "desktop");
    // The offer is caught by a script in the page head (it can come before this mounts) and announced.
    const w = window as Window & { __amorphixInstall?: Prompt };
    const onPrompt = () => w.__amorphixInstall && setPrompt(w.__amorphixInstall);
    onPrompt();
    const onInstalled = () => {
      setPrompt(null);
      setOpen(false);
      chime();
    };
    window.addEventListener("amorphix-installable", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("amorphix-installable", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!open || qr || device !== "desktop") return;
    QRCode.toDataURL(window.location.origin, { margin: 1, width: 360, color: { dark: "#0e1a2b", light: "#ffffff" } }).then(setQr, () => {});
  }, [open, qr, device]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!device) return null;

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    // An offer can be used once; Chrome makes a new one on a later visit if they said no.
    (window as Window & { __amorphixInstall?: Prompt }).__amorphixInstall = undefined;
    await prompt.userChoice;
    setPrompt(null);
  };
  const press = () => {
    tick();
    // a phone with the browser's own offer installs straight away
    if (device !== "desktop" && prompt) return void install();
    setOpen((v) => !v);
  };

  return (
    <div ref={box} className="relative">
      <motion.button
        type="button"
        onClick={press}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.96 }}
        aria-expanded={open}
        aria-label="Get the app"
        className="group relative flex h-9 items-center gap-2 overflow-hidden whitespace-nowrap rounded-full border border-line bg-paper-raised/80 px-2.5 text-sm text-ink backdrop-blur transition hover:border-accent/60 hover:text-accent hover:shadow-[0_8px_28px_-14px_var(--accent)] sm:px-3.5"
      >
        {/* a thin light that crosses the button now and then, like a scan */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-10 -skew-x-12 bg-gradient-to-r from-transparent via-accent/20 to-transparent motion-reduce:hidden"
          initial={{ x: "-200%" }}
          animate={{ x: "500%" }}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
        />
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="relative">
          <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
          <path d="M12 7.5v6m-2.5-2.5 2.5 2.5 2.5-2.5M11 18h2" />
        </svg>
        <span className="relative hidden sm:inline">Get the app</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-12 z-50 w-[19rem] overflow-hidden rounded-2xl border border-line bg-paper-raised text-sm shadow-[0_24px_70px_-30px_var(--accent)]"
          >
            <p className="border-b border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-accent">&gt; Amorphix as an app</p>
            {device === "desktop" ? (
              <>
                <div className="flex items-center gap-4 p-4">
                  <div className="relative w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-white p-1">
                    {qr ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qr} alt="Code that opens Amorphix on your phone" className="h-auto w-full" />
                    ) : (
                      <div className="aspect-square" />
                    )}
                    <motion.span aria-hidden className="pointer-events-none absolute inset-x-0 h-6 bg-gradient-to-b from-transparent via-accent/30 to-transparent motion-reduce:hidden" initial={{ top: "-25%" }} animate={{ top: "100%" }} transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">On your phone</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">Scan with the camera. Then on iPhone: Share, Add to Home Screen. On Android: Install app.</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">On this computer</p>
                    <p className="text-xs text-ink-soft">{prompt ? "Its own window, in your dock or taskbar." : "Open Amorphix in Chrome or Edge to install it."}</p>
                  </div>
                  {prompt && (
                    <button
                      type="button"
                      onClick={() => {
                        tick();
                        void install();
                      }}
                      className="shrink-0 rounded-full bg-btn px-3.5 py-1.5 text-xs text-btn-ink transition hover:opacity-90"
                    >
                      Install
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="p-4 leading-relaxed">
                {device === "ios" ? (
                  <>
                    Tap <strong>Share</strong> at the bottom of Safari, then <strong>Add to Home Screen</strong>. Amorphix opens full screen, like an app.
                  </>
                ) : (
                  <>
                    Tap the browser menu <strong>⋮</strong>, then <strong>Install app</strong> or <strong>Add to Home screen</strong>. Amorphix opens full screen, like an app.
                  </>
                )}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
