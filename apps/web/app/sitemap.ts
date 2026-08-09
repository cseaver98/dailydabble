import type { MetadataRoute } from "next";

const siteUrl = "https://dailydabble.app";
const archivePaths = ["/agegaple/archive", "/doodle/archive", "/moviedle/archive", "/yeardle/archive", "/equadle/archive", "/sportle/archive"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: siteUrl, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/verble`, lastModified, changeFrequency: "daily", priority: 0.9 },
    ...archivePaths.map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
