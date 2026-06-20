import "./globals.css";

const isStagingEnvironment = () => process.env.NEXT_PUBLIC_APP_ENV === "staging";

export const generateMetadata = () => ({
  title: isStagingEnvironment() ? "DailyDabble Admin Staging" : "DailyDabble Admin",
  description: "Unified content curation for DailyDabble games",
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
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
