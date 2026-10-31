"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Browser speech: recognition to listen, synthesis to speak, and a level meter for the voice orb.
// ponytail: browser voices vary by device; swap in a hosted voice when the final model is chosen.

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function makeRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition })
    .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/** Listening in `lang` ("en-IN", "hi-IN"); `onFinal` gets each finished sentence. */
export function useListen(onFinal: (text: string) => void, lang = "en-IN") {
  const rec = useRef<Recognition | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  useEffect(() => {
    setSupported(makeRecognition() !== null);
  }, []);

  const start = useCallback(() => {
    const r = makeRecognition();
    if (!r) return;
    rec.current?.stop();
    r.lang = lang;
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e) => {
      let finalText = "";
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else partial += res[0].transcript;
      }
      setInterim(partial);
      if (finalText.trim()) onFinal(finalText.trim());
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    r.onerror = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [onFinal, lang]);

  const stop = useCallback(() => rec.current?.stop(), []);
  return { supported, listening, interim, start, stop };
}

/** The best installed voice for a language: an exact match, then the same language anywhere, preferring natural ones. */
function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  const all = window.speechSynthesis?.getVoices() ?? [];
  const base = lang.split("-")[0];
  const fits = all.filter((v) => v.lang === lang || v.lang.startsWith(`${base}-`) || v.lang === base);
  const natural = (v: SpeechSynthesisVoice) => /natural|google|neural|premium|enhanced/i.test(v.name);
  return fits.find((v) => v.lang === lang && natural(v)) ?? fits.find(natural) ?? fits.find((v) => v.lang === lang) ?? fits[0];
}

/** Speaking aloud. `onDone` runs when an utterance finishes, so voice mode can listen again. */
export function useSpeak(onDone?: () => void) {
  const [on, setOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  // Voices load asynchronously in Chrome; asking once wakes the list up.
  useEffect(() => {
    window.speechSynthesis?.getVoices();
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  /** Says `text` in `lang` ("en", "hi-IN"); returns false if speech is off or unavailable. */
  const speak = useCallback(
    (text: string, lang = "en") => {
      if (!on || typeof window === "undefined" || !window.speechSynthesis || !text) return false;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const target = lang === "en" ? navigator.language || "en-US" : lang;
      u.lang = target;
      const v = voiceFor(target);
      if (v) u.voice = v;
      u.rate = 1.02;
      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        done.current?.();
      };
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
      return true;
    },
    [on],
  );

  const toggle = useCallback(() => {
    setOn((v) => {
      if (v) window.speechSynthesis?.cancel();
      return !v;
    });
  }, []);

  return { on, speaking, speak, stop, toggle };
}

/** The microphone's loudness, 0 to 1, about 30 times a second while `active`; 0 otherwise or without permission. */
export function useMicLevel(active: boolean) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let live = true;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (!live) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        ctx = new AudioContext();
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        ctx.createMediaStreamSource(s).connect(an);
        const buf = new Uint8Array(an.fftSize);
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (const b of buf) sum += ((b - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {});
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
      setLevel(0);
    };
  }, [active]);
  return level;
}
