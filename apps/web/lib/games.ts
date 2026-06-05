export type Game = {
  slug: string;
  name: string;
  href: string;
  description: string;
};

export const games: Game[] = [
  {
    slug: "verble",
    name: "Verble",
    href: "/verble",
    description: "Guess the daily phrase one word at a time.",
  },
  {
    slug: "agegaple",
    name: "Agegaple",
    href: "/agegaple",
    description: "Guess the celebrity couple age gap.",
  },
  {
    slug: "doodle",
    name: "Doodle",
    href: "/doodle",
    description: "Guess the doodle as it is drawn.",
  },
  {
    slug: "equadle",
    name: "Equadle",
    href: "/equadle",
    description: "Guess the hidden arithemetic equation.",
  },
  {
    slug: "yeardle",
    name: "Yeardle",
    href: "/yeardle",
    description: "Guess the year of the historic event.",
  },
  {
    slug: "moviedle",
    name: "Moviedle",
    href: "/moviedle",
    description: "Guess the movie from stills.",
  },
  {
    slug: "sportle",
    name: "Sportle",
    href: "/sportle",
    description: "Guess the pro athlete.",
  },
];

export const allowedGameSlugs = new Set(games.map((game) => game.slug));
