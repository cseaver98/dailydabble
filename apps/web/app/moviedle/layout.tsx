import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moviedle | DailyDabble",
  description: "Guess the movie from stills.",
};

export default function MoviedleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
