import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { PageLoading } from "@/components/fx/PageLoading";
import { ProjectView } from "@/components/project/ProjectView";

export const metadata: Metadata = { title: "Your design · Amorphix" };

async function Project({ params }: { params: PageProps<"/project/[id]">["params"] }) {
  const { id } = await params;
  // keyed by the project, so moving from one project to another starts fresh rather than carrying the last one's state
  return <ProjectView key={id} id={id} />;
}

// The header renders at once; the project streams in behind it.
export default function ProjectPage({ params }: PageProps<"/project/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Suspense fallback={<PageLoading label="Opening the project" />}>
        <Project params={params} />
      </Suspense>
    </div>
  );
}
