import type { MetadataRoute } from "next";

const siteUrl = "https://dailydabble.app";
const gamePaths = ["/verble", "/agegaple", "/doodle", "/moviedle", "/yeardle", "/equadle", "/sportle"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: siteUrl, lastModified, changeFrequency: "daily", priority: 1 },
    ...gamePaths.map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
  ];
}
