import type { Metadata } from "next";

export const siteUrl = "https://dailydabble.app";

export type GameSeoSlug =
  | "verble"
  | "agegaple"
  | "doodle"
  | "moviedle"
  | "yeardle"
  | "equadle"
  | "sportle";

type GameSeoConfig = {
  name: string;
  path: `/${GameSeoSlug}`;
  title: string;
  heading: string;
  description: string;
  intro: string;
  details: string;
  howToPlay: [string, string, string];
  iconSrc: string;
};

export const gameSeo: Record<GameSeoSlug, GameSeoConfig> = {
  verble: {
    name: "Verble",
    path: "/verble",
    title: "Verble: Free Daily Phrase Guessing Game",
    heading: "Verble: a free daily phrase guessing game",
    description:
      "Play Verble free every day. Guess one word at a time to reveal a familiar phrase, with six guesses and one risky shot at the full answer.",
    intro:
      "Verble is a daily word game where every correct guess reveals part of a familiar phrase. Work through the phrase one word at a time and solve it in six guesses or fewer.",
    details:
      "Think you know the answer early? You can attempt the full phrase at any time, but a wrong full-phrase guess ends the game. A fresh Verble puzzle is available every day.",
    howToPlay: [
      "Choose a hidden word and enter your guess.",
      "Use the letter feedback and revealed words to narrow down the phrase.",
      "Solve every word or risk a full-phrase guess before your six attempts run out.",
    ],
    iconSrc: "/verble-mark-v5.png",
  },
  agegaple: {
    name: "Agegaple",
    path: "/agegaple",
    title: "Agegaple: Free Daily Celebrity Age Gap Game",
    heading: "Agegaple: the daily celebrity age gap game",
    description:
      "Play Agegaple free every day. Study a celebrity couple, estimate the difference between their ages, and use each clue to improve your next guess.",
    intro:
      "Agegaple is a quick daily celebrity trivia game. Look at the featured couple and guess the age difference between them, using warmer and colder feedback to close in on the answer.",
    details:
      "Each puzzle tests your pop-culture knowledge and number sense without requiring a download. Come back tomorrow for a new couple and a new age gap to uncover.",
    howToPlay: [
      "Study the photos and names of the featured celebrity couple.",
      "Enter your best estimate of the difference between their ages.",
      "Use the feedback from each attempt to reach the exact age gap.",
    ],
    iconSrc: "/agegaple-mark-v3.png",
  },
  doodle: {
    name: "Doodle",
    path: "/doodle",
    title: "Doodle: Free Daily Drawing Guessing Game",
    heading: "Doodle: a free daily drawing guessing game",
    description:
      "Play Doodle free every day. Watch a picture appear one stroke at a time and identify it before the complete drawing is revealed.",
    intro:
      "Doodle is a daily picture guessing game that draws the clue a little at a time. Guess quickly for the best result, or wait for more of the illustration when you need another hint.",
    details:
      "Every day brings a new drawing and a new visual challenge. Doodle plays directly in your browser and only takes a couple of minutes.",
    howToPlay: [
      "Watch the daily drawing appear in stages.",
      "Enter a guess whenever you recognize the subject.",
      "Use later drawing stages as extra clues if your first answer misses.",
    ],
    iconSrc: "/doodle-mark-v2.png",
  },
  moviedle: {
    name: "Moviedle",
    path: "/moviedle",
    title: "Moviedle: Free Daily Movie Guessing Game",
    heading: "Moviedle: a free daily movie guessing game",
    description:
      "Play Moviedle free every day. Identify a movie from a sequence of still images and test how quickly you recognize films across every genre.",
    intro:
      "Moviedle is a daily movie trivia game for film fans. Each incorrect guess reveals another still from the same movie, giving you more visual clues to identify the title.",
    details:
      "From famous blockbusters to memorable favorites, every puzzle challenges your movie knowledge in a few quick rounds. A new film is featured each day.",
    howToPlay: [
      "Study the first still from the mystery movie.",
      "Enter the film title or reveal another image when you need a clue.",
      "Name the movie in as few stills as possible.",
    ],
    iconSrc: "/moviedle-mark-v2.png",
  },
  yeardle: {
    name: "Yeardle",
    path: "/yeardle",
    title: "Yeardle: Free Daily History Year Guessing Game",
    heading: "Yeardle: the daily history year guessing game",
    description:
      "Play Yeardle free every day. Read an event from this day in history, guess the year it happened, and use each clue to move closer.",
    intro:
      "Yeardle is a daily history trivia game built around events that happened on today’s date. Guess the year, then use the higher-or-lower feedback to refine your next attempt.",
    details:
      "It is a quick way to test your sense of history and learn something new every day. Each puzzle includes a fresh event and a year waiting to be discovered.",
    howToPlay: [
      "Read the clue about an event from this day in history.",
      "Guess the year in which the event occurred.",
      "Follow the higher-or-lower feedback until you find the exact year.",
    ],
    iconSrc: "/yeardle-mark-v3.png",
  },
  equadle: {
    name: "Equadle",
    path: "/equadle",
    title: "Equadle: Free Daily Math Equation Puzzle",
    heading: "Equadle: a free daily math equation puzzle",
    description:
      "Play Equadle free every day. Use logic, arithmetic, and color feedback to uncover the hidden equation in a limited number of guesses.",
    intro:
      "Equadle is a daily math puzzle where the answer is a complete arithmetic equation. Each guess shows which numbers and operators are correct, misplaced, or absent.",
    details:
      "Combine calculation with deduction to solve the equation before your attempts run out. Every puzzle is playable in your browser and refreshes daily.",
    howToPlay: [
      "Enter a valid equation that fits the daily board.",
      "Read the color feedback for each number and operator.",
      "Rearrange the possibilities and solve the hidden equation.",
    ],
    iconSrc: "/equadle-mark-v4.png",
  },
  sportle: {
    name: "Sportle",
    path: "/sportle",
    title: "Sportle: Free Daily Sports Trivia Game",
    heading: "Sportle: a free daily sports trivia game",
    description:
      "Play Sportle free every day. Use a series of career clues to identify the mystery professional athlete in as few guesses as possible.",
    intro:
      "Sportle is a daily sports trivia game that challenges you to name a professional athlete. Reveal career facts one by one and see how quickly you can connect the clues.",
    details:
      "The featured athletes span different teams, eras, and sports, so every day tests a different corner of your sports knowledge.",
    howToPlay: [
      "Read the first clue about the mystery athlete.",
      "Submit a name or reveal another career fact.",
      "Identify the athlete using as few clues as possible.",
    ],
    iconSrc: "/sportle-mark-v2.png",
  },
};

export const buildGameMetadata = (slug: GameSeoSlug): Metadata => {
  const game = gameSeo[slug];

  return {
    title: game.title,
    description: game.description,
    alternates: { canonical: game.path },
    openGraph: {
      title: `${game.title} | DailyDabble`,
      description: game.description,
      url: game.path,
      siteName: "DailyDabble",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${game.title} | DailyDabble`,
      description: game.description,
      images: ["/opengraph-image?v=20260714"],
    },
  };
};
