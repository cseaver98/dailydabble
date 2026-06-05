import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Equadle | DailyDabble",
  description: "Guess the hidden arithmetic equation.",
};

export default function EquadleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
