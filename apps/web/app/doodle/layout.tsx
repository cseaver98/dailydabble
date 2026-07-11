import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Doodle",
  description: "Play Doodle, a daily drawing game where you guess the answer as the picture is drawn.",
};

export default function DoodleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
