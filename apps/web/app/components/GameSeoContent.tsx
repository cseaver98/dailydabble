import { gameSeo, siteUrl, type GameSeoSlug } from "@/lib/game-seo";

export default function GameSeoContent({ slug }: { slug: GameSeoSlug }) {
  const game = gameSeo[slug];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${siteUrl}${game.path}#game`,
        name: game.name,
        url: `${siteUrl}${game.path}`,
        description: game.description,
        applicationCategory: "GameApplication",
        applicationSubCategory: "Daily puzzle game",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript and a modern web browser",
        isAccessibleForFree: true,
        image: `${siteUrl}${game.iconSrc}`,
        offers: {
          "@type": "Offer",
          price: 0,
          priceCurrency: "USD",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "DailyDabble",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: game.name,
            item: `${siteUrl}${game.path}`,
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
    />
  );
}
