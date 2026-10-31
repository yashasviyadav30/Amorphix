import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Reveal } from "@/components/fx/Motion";
import { PageLoading } from "@/components/fx/PageLoading";
import { proProfile } from "@/lib/pros/directory";

export const metadata: Metadata = { title: "Pro · Amorphix" };

const UUID = /^[0-9a-f-]{36}$/;

async function Profile({ params }: { params: PageProps<"/pros/[id]">["params"] }) {
  const { id } = await params;
  const p = UUID.test(id) ? await proProfile(id) : null;
  if (!p) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-8">
      <Reveal className="flex items-center gap-5">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-line bg-paper-raised font-serif text-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-contain" /> : (p.company ?? p.name)[0]}
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent">{p.role === "architect" ? "Architect or interior designer" : "Builder or contractor"}</p>
          <h1 className="font-serif text-5xl leading-tight">{p.company ?? p.name}</h1>
          <p className="text-ink-soft">
            {p.company ? `${p.name} · ` : ""}
            {p.city}
          </p>
        </div>
      </Reveal>
      {p.about && <Reveal delay={0.05} className="mt-6 text-lg">{p.about}</Reveal>}
      <Reveal delay={0.1} className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-paper-raised p-4">
          <p className="font-serif text-3xl">{p.projects}</p>
          <p className="text-sm text-ink-soft">projects designed on Amorphix</p>
          {p.rating && <p className="mt-1 text-sm text-amber-600">{p.rating} from clients who moved in</p>}
        </div>
        <div className="rounded-2xl border border-line bg-paper-raised p-4">
          <p className="text-sm font-medium">Fees</p>
          <p className="text-sm text-ink-soft">{p.fee_note ?? "Ask in your request"}</p>
        </div>
      </Reveal>
      {p.said.length > 0 && (
        <Reveal delay={0.12} className="mt-6 space-y-2">
          <p className="text-sm font-medium">What clients said</p>
          {p.said.map((r, i) => (
            <blockquote key={i} className="rounded-2xl border border-line bg-paper-raised p-4 text-sm">
              <span className="text-amber-600">{"★".repeat(r.rating)}</span>
              <span className="mt-1 block">&ldquo;{r.text}&rdquo;</span>
            </blockquote>
          ))}
        </Reveal>
      )}
      {p.styles.length > 0 && (
        <Reveal delay={0.15} className="mt-6">
          <p className="text-sm font-medium">Styles of their past work</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.styles.map((s) => (
              <span key={s} className="rounded-full bg-accent/10 px-3 py-1 text-sm text-accent">
                {s}
              </span>
            ))}
          </div>
        </Reveal>
      )}
    </main>
  );
}

export default function ProPage({ params }: PageProps<"/pros/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Suspense fallback={<PageLoading />}>
        <Profile params={params} />
      </Suspense>
    </div>
  );
}
