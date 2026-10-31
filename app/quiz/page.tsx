import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Quiz } from "@/components/quiz/Quiz";

export const metadata: Metadata = {
  title: "What's your space style? · Amorphix",
  description: "Show Amorphix photos of spaces you love; its taste model reads your style on your own device.",
};

export default function QuizPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Quiz />
    </div>
  );
}
