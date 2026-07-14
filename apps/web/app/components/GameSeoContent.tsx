import Image from "next/image";
import Link from "next/link";

import { games } from "@/lib/games";
import { gameSeo, siteUrl, type GameSeoSlug } from "@/lib/game-seo";

export default function GameSeoContent({ slug }: { slug: GameSeoSlug }) {
  const game = gameSeo[slug];
  const relatedGames = games.filter((candidate) => candidate.slug !== slug);
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
    <section className="game-seo-section" aria-labelledby={`${slug}-about-title`}>
      <div className="game-seo-card">
        <div className="game-seo-heading-row">
          <Image src={game.iconSrc} alt="" width={56} height={56} className="game-seo-icon" />
          <div>
            <p className="game-seo-eyebrow">Free daily game</p>
            <h1 id={`${slug}-about-title`}>{game.heading}</h1>
          </div>
        </div>

        <div className="game-seo-intro">
          <p>{game.intro}</p>
          <p>{game.details}</p>
        </div>

        <div className="game-seo-columns">
          <div>
            <h2>How to play {game.name}</h2>
            <ol>
              {game.howToPlay.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          <div>
            <h2>Explore more daily games</h2>
            <p>Try another quick word, trivia, picture, history, sports, or math challenge on DailyDabble.</p>
            <nav className="game-seo-links" aria-label="More DailyDabble games">
              {relatedGames.map((relatedGame) => (
                <Link key={relatedGame.slug} href={relatedGame.href}>
                  {relatedGame.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
    </section>
  );
}
