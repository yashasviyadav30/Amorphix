import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Docs } from "@/components/resources/Docs";

export const metadata: Metadata = { title: "Resources · Amorphix", description: "Guides, how Amorphix works, questions and a developer guide." };

export default function ResourcesPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Docs />
    </div>
  );
}
