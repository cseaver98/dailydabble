export type Game = {
  slug: string;
  name: string;
  href: string;
  description: string;
};

export const games: Game[] = [
  {
    slug: "agegaple",
    name: "Agegaple",
    href: "https://agegaple.dailydabble.app",
    description: "Guess the celebrity couple age gap.",
  },
  {
    slug: "doodle",
    name: "Doodle",
    href: "https://doodle.dailydabble.app",
    description: "Guess the doodle as it is drawn.",
  },
  {
    slug: "yeardle",
    name: "Yeardle",
    href: "https://yeardle.dailydabble.app",
    description: "Guess the year of the historic event.",
  },
  {
    slug: "equadle",
    name: "Equadle",
    href: "https://equadle.dailydabble.app",
    description: "Guess the hidden arithemetic equation.",
  },
  {
    slug: "moviedle",
    name: "Moviedle",
    href: "https://moviedle.dailydabble.app",
    description: "Guess the movie from stills.",
  },
  {
    slug: "sportle",
    name: "Sportle",
    href: "https://sportle.dailydabble.app",
    description: "Guess the pro athlete.",
  },
];

export const allowedGameSlugs = new Set(games.map((game) => game.slug));
