import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { UploadPlan } from "@/components/import/UploadPlan";

export const metadata: Metadata = { title: "Start from your plan · Amorphix" };

export default function UploadPlanPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <UploadPlan />
    </div>
  );
}
