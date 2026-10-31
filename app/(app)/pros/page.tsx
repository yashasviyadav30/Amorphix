import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { ProsDirectory } from "@/components/pros/ProsDirectory";

export const metadata: Metadata = { title: "Find a pro · Amorphix" };

export default function ProsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <ProsDirectory />
    </div>
  );
}
