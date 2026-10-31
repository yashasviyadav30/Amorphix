import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ProfileForm } from "@/components/account/ProfileForm";
import { currentUser } from "@/lib/auth/server";
import { PageLoading } from "@/components/fx/PageLoading";
import { emailOf, getProfile, safeNext } from "@/lib/account/profile";

export const metadata: Metadata = { title: "Welcome · Amorphix" };

// New accounts land here once: pick a role, then a short profile.
async function WelcomePageBody({ searchParams }: { searchParams: PageProps<"/welcome">["searchParams"] }) {
  const q = await searchParams;
  const next = safeNext(typeof q.next === "string" ? q.next : null);
  const userId = await currentUser();
  if (!userId) redirect(`/login?next=${encodeURIComponent("/welcome")}`);
  const [profile, email] = await Promise.all([getProfile(userId), emailOf(userId)]);
  if (profile) redirect(next);
  return (
    <main className="flex-1 px-4 py-10 sm:px-8">
      <ProfileForm initial={null} email={email} next={next} />
    </main>
  );
}

// The header shows at once; the part that needs the signed-in user streams in behind it.
export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Suspense fallback={<PageLoading />}>
        <WelcomePageBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
