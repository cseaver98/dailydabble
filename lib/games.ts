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
];

export const allowedGameSlugs = new Set(games.map((game) => game.slug));
