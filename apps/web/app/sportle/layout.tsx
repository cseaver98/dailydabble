import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sportle | DailyDabble",
  description: "Guess the pro athlete from the daily clues.",
};

export default function SportleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
