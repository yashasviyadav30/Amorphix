import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SignIn } from "@/components/account/SignIn";
import { currentUser } from "@/lib/auth/server";
import { PageLoading } from "@/components/fx/PageLoading";
import { safeNext } from "@/lib/account/profile";

export const metadata: Metadata = { title: "Sign in · Amorphix" };

async function LoginPageBody({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const q = await searchParams;
  const next = safeNext(typeof q.next === "string" ? q.next : null);
  if (await currentUser()) redirect(next);
  return (
    <main className="flex flex-1 items-center px-4 py-10 sm:px-8">
      <SignIn next={next} signup={q.mode === "signup"} />
    </main>
  );
}

// The header shows at once; the part that needs the signed-in user streams in behind it.
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Suspense fallback={<PageLoading />}>
        <LoginPageBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
