import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verble",
  description: "Play Verble, the daily phrase game. Reveal the phrase by guessing one word at a time in six guesses or fewer.",
};

export default function VerbleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
