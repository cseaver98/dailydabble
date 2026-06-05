import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yeardle | DailyDabble",
  description: "Guess the year of the historic event.",
};

export default function YeardleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
