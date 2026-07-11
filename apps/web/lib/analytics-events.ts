import { allowedGameSlugs } from "@/lib/games";

export const analyticsEventNames = [
  "homepage_viewed",
  "game_opened",
  "game_started",
  "game_completed",
  "next_game_clicked",
  "result_shared",
  "account_wall_shown",
  "signup_started",
  "signup_completed",
  "reminder_prompt_shown",
  "reminder_enabled",
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export type AnalyticsEventInput = {
  eventName: AnalyticsEventName;
  gameSlug?: string;
  puzzleDate?: string;
  isArchive?: boolean;
  metadata?: Record<string, unknown>;
};

export const isAnalyticsEventName = (value: unknown): value is AnalyticsEventName =>
  typeof value === "string" && (analyticsEventNames as readonly string[]).includes(value);

export const isAnalyticsGameSlug = (value: unknown): value is string =>
  typeof value === "string" && allowedGameSlugs.has(value);
