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
    description: "Guess the age gap with daily clues.",
  },
  {
    slug: "yelple",
    name: "Yelple",
    href: "https://yelple.dailydabble.app",
    description: "Solve the daily trivia challenge.",
  },
  {
    slug: "doodle",
    name: "Doodle",
    href: "https://doodle.dailydabble.app",
    description: "Guess the doodle as it is drawn in stages.",
  },
  {
    slug: "yeardle",
    name: "Yeardle",
    href: "https://yeardle.dailydabble.app",
    description: "Guess the year from a historical event image and clues.",
  },
  {
    slug: "equadle",
    name: "Equadle",
    href: "https://equadle.dailydabble.app",
    description: "Guess the hidden arithmetic equation in six tries.",
  },
  {
    slug: "moviedle",
    name: "Moviedle",
    href: "https://moviedle.dailydabble.app",
    description: "Guess the daily movie from still reveals.",
  },
  {
    slug: "sportle",
    name: "Sportle",
    href: "https://sportle.dailydabble.app",
    description: "Guess the daily pro athlete from revealed clues.",
  },
];

export const allowedGameSlugs = new Set(games.map((game) => game.slug));
