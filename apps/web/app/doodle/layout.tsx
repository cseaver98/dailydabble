import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Doodle | DailyDabble",
  description: "Guess the doodle as it is drawn.",
};

export default function DoodleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
