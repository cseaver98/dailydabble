import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Equadle",
  description: "Play Equadle, the daily math puzzle. Use each guess to uncover the hidden arithmetic equation.",
};

export default function EquadleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
