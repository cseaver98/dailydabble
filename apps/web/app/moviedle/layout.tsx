import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moviedle",
  description: "Play Moviedle, the daily movie game. Identify the film from a sequence of movie stills.",
};

export default function MoviedleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
