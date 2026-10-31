import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Interview } from "@/components/interview/Interview";

export const metadata: Metadata = { title: "Let's get to know you · Amorphix" };

export default function StartPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Interview />
    </div>
  );
}
