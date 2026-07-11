import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agegaple",
  description: "Play Agegaple, the daily celebrity game. Study two photos and guess the couple's age gap.",
};

export default function AgegapleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
