import type { Metadata } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "@dailydabble/ui/nav.css";
import "./globals.css";
import "./verble/verble.css";
import "./sportle/sportle.css";
import "./yeardle/yeardle.css";
import "./equadle/equadle.css";
import "./moviedle/moviedle.css";
import "./doodle/doodle.css";
import "./agegaple/agegaple.css";
import AuthStateStorageBoundary from "./components/AuthStateStorageBoundary";
import DailyReminderPrompt from "./components/DailyReminderPrompt";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const subscriberBootScript = `
try {
  var isSubscriber = window.localStorage.getItem("dailydabble:v1:is-subscriber") === "true";
  document.documentElement.dataset.dailyDabbleSubscriber = isSubscriber ? "true" : "false";
} catch (_) {
  document.documentElement.dataset.dailyDabbleSubscriber = "false";
}
`;

const isStagingEnvironment = (): boolean => process.env.NEXT_PUBLIC_APP_ENV === "staging";

export const generateMetadata = (): Metadata => ({
  title: isStagingEnvironment() ? "DailyDabble Staging" : "DailyDabble",
  description: "Daily trivia game hub",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: isStagingEnvironment() ? "DailyDabble Staging" : "DailyDabble",
    description: "The daily trivia game hub",
    images: ["/opengraph-image"],
  },
  robots: isStagingEnvironment()
    ? {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      }
    : undefined,
  icons: {
    icon: [
      { url: "/apple-icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/apple-icon.png",
    apple: "/apple-icon.png",
  },
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plusJakartaSans.variable} ${manrope.variable} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: subscriberBootScript }} />
        <AuthStateStorageBoundary />
        <DailyReminderPrompt />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
