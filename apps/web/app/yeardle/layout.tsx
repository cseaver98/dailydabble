import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yeardle",
  description: "Play Yeardle, the daily history game. Use the clues to guess the year of an event from this day in history.",
};

export default function YeardleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
