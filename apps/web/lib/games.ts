export type Game = {
  slug: string;
  name: string;
  href: string;
  description: string;
  iconSrc: string;
  iconAlt: string;
  iconBackground: string;
};

export const games: Game[] = [
  {
    slug: "verble",
    name: "Verble",
    href: "/verble",
    description: "Guess the daily phrase one word at a time.",
    iconSrc: "/verble-mark-v3.png",
    iconAlt: "Verble logo",
    iconBackground: "#fdfadf",
  },
  {
    slug: "agegaple",
    name: "Agegaple",
    href: "/agegaple",
    description: "Guess the celebrity couple age gap.",
    iconSrc: "/agegaple-mark-v3.png",
    iconAlt: "Agegaple logo",
    iconBackground: "#faebf0",
  },
  {
    slug: "doodle",
    name: "Doodle",
    href: "/doodle",
    description: "Guess the doodle as it is drawn.",
    iconSrc: "/doodle-mark-v2.png",
    iconAlt: "Doodle logo",
    iconBackground: "#e0f2fe",
  },
  {
    slug: "equadle",
    name: "Equadle",
    href: "/equadle",
    description: "Guess the hidden arithmetic equation.",
    iconSrc: "/equadle-mark-v2.png",
    iconAlt: "Equadle logo",
    iconBackground: "#ffe4e6",
  },
  {
    slug: "yeardle",
    name: "Yeardle",
    href: "/yeardle",
    description: "Guess the year of an event from this day in history.",
    iconSrc: "/yeardle-mark-v2.png",
    iconAlt: "Yeardle logo",
    iconBackground: "#ede9fe",
  },
  {
    slug: "moviedle",
    name: "Moviedle",
    href: "/moviedle",
    description: "Guess the movie from stills.",
    iconSrc: "/moviedle-mark-v2.png",
    iconAlt: "Moviedle logo",
    iconBackground: "#ccfbf1",
  },
  {
    slug: "sportle",
    name: "Sportle",
    href: "/sportle",
    description: "Guess the pro athlete.",
    iconSrc: "/sportle-mark-v2.png",
    iconAlt: "Sportle logo",
    iconBackground: "#fef3c7",
  },
];

export const allowedGameSlugs = new Set(games.map((game) => game.slug));
