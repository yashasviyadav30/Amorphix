"use client";

// Interface sounds made live with Web Audio: no files to download.
// Browsers only allow sound after the user has interacted with the page, so the context starts
// on the first click or key press and every sound before that is skipped silently.

const KEY = "amorphix-sound";
let ctx: AudioContext | null = null;
let out: AudioNode | null = null; // master output: a compressor keeps louder blips clean
let gestured = false; // the page has had a click or key press, so sound is allowed

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !soundOn()) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    const master = ctx.createGain();
    master.gain.value = 1.6;
    comp.connect(master).connect(ctx.destination);
    out = comp;
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  // A context the browser paused (after the tab was in the background) still takes sounds once the user has
  // interacted: they play as it resumes, instead of being dropped. Before any interaction, stay silent.
  if (ctx.state === "running" || (ctx.state === "suspended" && gestured)) return ctx;
  return null;
}

// Wake the audio context on the first user gesture anywhere on the page.
if (typeof window !== "undefined") {
  const wake = () => {
    gestured = true;
    audio();
  };
  window.addEventListener("pointerdown", wake, { passive: true });
  window.addEventListener("keydown", wake);
}

function tone(freq: number, ms: number, { type = "square" as OscillatorType, gain = 0.025, to }: { type?: OscillatorType; gain?: number; to?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + ms / 1000);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(g).connect(out ?? a.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

// Recorded sounds: a sci-fi "computer processing" loop and a short data burst, cut from a Pixabay track
// with its background music removed (high-pass at 2.2 kHz and a gate, so only the short blips remain),
// (Pixabay Content License: free for commercial use in an app, no attribution required).
const buffers = new Map<string, Promise<AudioBuffer | null>>();
function load(url: string): Promise<AudioBuffer | null> {
  if (!buffers.has(url)) {
    buffers.set(
      url,
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((b) => (audio() ?? new AudioContext()).decodeAudioData(b))
        .catch(() => null),
    );
  }
  return buffers.get(url)!;
}

// Fetch the recordings early so they start instantly when needed.
export function preload() {
  void load("/sfx/processing.mp3");
  void load("/sfx/burst.mp3");
}

// The processing bed: loops while the engine works, fades in and out. Returns a stop function.
export function startProcessing(): () => void {
  let stop = () => {};
  let cancelled = false;
  void load("/sfx/processing.mp3").then((buf) => {
    const a = audio();
    if (!buf || !a || cancelled) return;
    const src = a.createBufferSource();
    const g = a.createGain();
    src.buffer = buf;
    src.loop = true;
    g.gain.setValueAtTime(0.0001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.55, a.currentTime + 0.6);
    src.connect(g).connect(out ?? a.destination);
    src.start();
    stop = () => {
      g.gain.cancelScheduledValues(a.currentTime);
      g.gain.setValueAtTime(g.gain.value, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.8);
      src.stop(a.currentTime + 0.85);
    };
  });
  return () => {
    cancelled = true;
    stop();
  };
}

// A short data burst, played when a headline decodes.
export function burst() {
  void load("/sfx/burst.mp3").then((buf) => {
    const a = audio();
    if (!buf || !a) return;
    const src = a.createBufferSource();
    const g = a.createGain();
    src.buffer = buf;
    g.gain.value = 0.5;
    src.connect(g).connect(out ?? a.destination);
    src.start();
  });
}

// A two-note "ok" when a log line finishes.
export function ok() {
  tone(880, 45, { type: "sine", gain: 0.05 });
  setTimeout(() => tone(1320, 55, { type: "sine", gain: 0.05 }), 50);
}

// A rising sweep when the screen moves to a new step.
export function whoosh() {
  tone(180, 280, { type: "sine", gain: 0.13, to: 720 });
}

// A soft chord when the design is ready.
export function chime() {
  [523.25, 659.25, 783.99].forEach((f, i) => setTimeout(() => tone(f, 480, { type: "sine", gain: 0.11 }), i * 70));
}

// A soft footstep: a short low thump of filtered noise.
export function step() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const n = Math.floor(a.sampleRate * 0.09);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 260 + Math.random() * 80;
  const g = a.createGain();
  g.gain.value = 0.55;
  src.connect(f).connect(g).connect(out ?? a.destination);
  src.start(t);
}

// A gentle bell when the walk enters a new room.
export function roomBell() {
  tone(659.25, 600, { type: "sine", gain: 0.07 });
  setTimeout(() => tone(987.77, 700, { type: "sine", gain: 0.05 }), 90);
}

// A tiny click for toggles and choices.
export function tick() {
  tone(1500, 22, { type: "sine", gain: 0.04 });
}

// Moving between design steps: a bright rising sweep with two data blips, made to carry on laptop speakers
// (the older low whoosh sat under what small speakers can play).
export function transition() {
  tone(320, 240, { type: "triangle", gain: 0.09, to: 1500 });
  setTimeout(() => tone(1800, 40, { type: "square", gain: 0.03 }), 120);
  setTimeout(() => tone(2400, 50, { type: "square", gain: 0.025 }), 175);
}

// A number counting up: soft blips that rise in pitch for `ms`, then the two-note "ok" as it lands.
export function counting(ms = 1100) {
  const steps = Math.max(6, Math.round(ms / 70));
  for (let i = 0; i < steps; i++) {
    // Blips come quicker at the start and slow as the number settles, like the count itself.
    const at = ms * (1 - Math.pow(1 - i / steps, 2));
    setTimeout(() => tone(900 + i * 60, 18, { type: "square", gain: 0.018 }), at);
  }
  setTimeout(ok, ms + 30);
}
