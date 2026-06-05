import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agegaple | DailyDabble",
  description: "Guess the celebrity couple age gap.",
};

export default function AgegapleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
