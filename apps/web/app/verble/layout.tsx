import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verble | DailyDabble",
  description: "Guess the daily phrase one word at a time.",
};

export default function VerbleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
