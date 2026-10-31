"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Decode, TypeLog } from "@/components/fx/Decode";
import { preload, startProcessing } from "@/components/fx/sfx";

const TYPES = [
  ["house", "A house"],
  ["apartment", "An apartment"],
  ["studio", "A studio"],
  ["office", "An office"],
  ["cafe", "A café or restaurant"],
  ["shop", "A shop or showroom"],
  ["hotel", "A hotel floor"],
] as const;

// Bring your own plan: upload it, Amorphix reads the rooms, and the user checks them on the next screen.
export function UploadPlan() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [spaceType, setSpaceType] = useState("house");
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");
  const [width, setWidth] = useState("");
  const [depth, setDepth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const send = async () => {
    if (!file) return setError("Choose a plan to upload first.");
    preload();
    setBusy(true);
    setError(null);
    const stop = startProcessing();
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("spaceType", spaceType);
      form.set("units", units);
      if (width) form.set("width", width);
      if (depth) form.set("depth", depth);
      const res = await fetch("/api/projects/import", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "We couldn't read that plan.");
      router.push(`/project/${body.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't read that plan.");
      setBusy(false);
    } finally {
      stop?.();
    }
  };

  if (busy)
    return (
      <main className="amorphix-scan mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16">
        <h1 className="font-serif text-4xl">
          <Decode text="Reading your plan" />
        </h1>
        <div className="mt-6 rounded-2xl border border-line bg-paper-raised/80 p-5">
          <TypeLog lines={["> reading the drawing", "> finding the rooms and walls", "> measuring every room", "> checking it the way an architect would"]} done={false} />
        </div>
      </main>
    );

  const unit = units === "imperial" ? "ft" : "m";
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <p className="text-sm uppercase tracking-widest text-ink-soft">Bring your own plan</p>
      <h1 className="mt-2 font-serif text-5xl">
        <Decode text="Start from your plan" />
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">
        Upload a floor plan: a photo, a scan or a PDF. Amorphix reads the rooms, you check them, and we style it to your taste and show it in 3D,
        next to two other ways to lay out the same rooms.
      </p>

      <label className="mt-8 grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-line bg-paper-raised p-8 text-center hover:border-accent">
        <input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Your plan" className="max-h-72 rounded-lg object-contain" />
        ) : (
          <span className="text-ink-soft">{file ? file.name : "Choose a plan, or drop it here"}</span>
        )}
        <span className="mt-3 text-sm text-ink-soft">PNG, JPG, WebP or PDF, up to 8 MB</span>
      </label>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">What is it?</span>
          <select value={spaceType} onChange={(e) => setSpaceType(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-paper-raised px-3 py-2.5">
            {TYPES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="text-sm font-medium">Building size, if the drawing has no measurements</span>
          <div className="mt-1 flex items-center gap-2">
            <input inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="width" className="w-24 rounded-xl border border-line bg-paper-raised px-3 py-2.5" />
            <span className="text-ink-soft">×</span>
            <input inputMode="decimal" value={depth} onChange={(e) => setDepth(e.target.value)} placeholder="depth" className="w-24 rounded-xl border border-line bg-paper-raised px-3 py-2.5" />
            <div role="radiogroup" aria-label="Units" className="flex rounded-full border border-line p-0.5">
              {(["imperial", "metric"] as const).map((u) => (
                <button key={u} role="radio" aria-checked={units === u} onClick={() => setUnits(u)} className={`rounded-full px-3 py-1 text-sm ${units === u ? "bg-btn text-btn-ink" : "text-ink-soft"}`}>
                  {u === "imperial" ? "ft" : "m"}
                </button>
              ))}
            </div>
          </div>
          <span className="mt-1 block text-xs text-ink-soft">Width across the front, depth front to back, in {unit}.</span>
        </div>
      </div>

      {error && <p className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>}
      <button onClick={() => void send()} disabled={!file} className="mt-8 rounded-full bg-btn px-8 py-3 text-lg text-btn-ink transition hover:opacity-90 disabled:opacity-40">
        Read my plan
      </button>
    </main>
  );
}
