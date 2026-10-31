import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Privacy · Amorphix" };

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 leading-relaxed">
        <h1 className="font-serif text-5xl">Privacy</h1>
        <p className="mt-6 text-ink-soft">Last updated 1 November 2026.</p>

        <h2 className="mt-10 font-serif text-3xl">Cookies</h2>
        <p className="mt-3">
          Amorphix sets one cookie, <code>amorphix_guest</code>. It holds a random id, signed so it can&apos;t be forged, that keeps your
          project yours without an account. Amorphix sets no analytics, tracking or advertising cookies.
        </p>

        <h2 className="mt-10 font-serif text-3xl">What we store</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Your project: its type, size, location, the answers you give, the changes you make, and the designs Amorphix makes.</li>
          <li>The places, brands, films and music you name, and the style the taste model reads from them and from any photos you add.</li>
        </ul>
        <p className="mt-3">We don&apos;t sell it or share it for advertising.</p>

        <h2 className="mt-10 font-serif text-3xl">Who processes it</h2>
        <p className="mt-3">
          The names you love go to an AI model, which describes the look each one evokes. Photos you add are read on your
          device and never uploaded: only the numbers the taste model makes from them (vectors) are sent, to be matched
          against style words and brands in our vector database. When Amorphix designs your space, your
          project&apos;s answers go to an AI model to write the brief and plan the rooms, and a change you type that
          Amorphix can&apos;t read on its own goes to the same model. Voice input and speech use your browser&apos;s
          built-in speech features.
        </p>

        <h2 className="mt-10 font-serif text-3xl">Deleting your data</h2>
        <p className="mt-3">Delete a project and everything in it from the project&apos;s overview, or your whole account from your account page, at any time. Clearing your browser&apos;s cookies also ends access to it from that browser.</p>
      </main>
    </div>
  );
}
