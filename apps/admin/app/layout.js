import "./globals.css";

export const metadata = {
  title: "DailyDabble Admin",
  description: "Unified content curation for DailyDabble games",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
