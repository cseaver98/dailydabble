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
import "./guess-progress.css";
import "./how-to-play.css";
import "./desktop-game-layout.css";
import AuthStateStorageBoundary from "./components/AuthStateStorageBoundary";
import AnalyticsPageTracker from "./components/AnalyticsPageTracker";

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
const twitterImageUrl = "/opengraph-image?v=20260712";
const siteUrl = "https://dailydabble.app";
const siteName = "DailyDabble";
const siteTitle = "DailyDabble: Play Verble, the Daily Phrase Game";
const siteDescription =
  "Play Verble, a free daily phrase game where you solve the saying one word at a time, then explore the DailyDabble game archives.";

export const generateMetadata = (): Metadata => {
  const title = isStagingEnvironment() ? "DailyDabble Staging" : siteTitle;
  const description = siteDescription;

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s | ${siteName}`,
    },
    description,
    alternates: { canonical: "/" },
    applicationName: siteName,
    category: "games",
    keywords: ["Verble", "daily phrase game", "word games", "daily word puzzle", "browser games", "DailyDabble"],
    manifest: "/manifest.webmanifest",
    openGraph: {
      title,
      description,
      siteName,
      url: "/",
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [twitterImageUrl],
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
  };
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: siteName,
        alternateName: "Daily Dabble",
        description: siteDescription,
        inLanguage: "en-US",
      },
      {
        "@type": "ItemList",
        "@id": `${siteUrl}/#daily-games`,
        name: "DailyDabble games",
        itemListElement: [
          ["Verble", "verble", "Guess the daily phrase one word at a time."],
          ["Agegaple Archive", "agegaple/archive", "Play past celebrity age-gap puzzles."],
          ["Doodle Archive", "doodle/archive", "Play past drawing puzzles."],
          ["Moviedle Archive", "moviedle/archive", "Play past movie puzzles."],
          ["Yeardle Archive", "yeardle/archive", "Play past history puzzles."],
          ["Equadle Archive", "equadle/archive", "Play past equation puzzles."],
          ["Sportle Archive", "sportle/archive", "Play past athlete puzzles."],
        ].map(([name, slug, description], index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "WebApplication",
            name,
            url: `${siteUrl}/${slug}`,
            description,
            applicationCategory: "GameApplication",
            operatingSystem: "Any",
            isAccessibleForFree: true,
          },
        })),
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      </head>
      <body className={`${plusJakartaSans.variable} ${manrope.variable} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: subscriberBootScript }} />
        <AuthStateStorageBoundary />
        <AnalyticsPageTracker />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
