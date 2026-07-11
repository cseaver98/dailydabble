import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sportle",
  description: "Play Sportle, the daily sports trivia game. Guess the professional athlete from a series of clues.",
};

export default function SportleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
