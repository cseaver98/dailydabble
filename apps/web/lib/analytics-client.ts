"use client";

import type { AnalyticsEventInput } from "@/lib/analytics-events";

const SESSION_ID_KEY = "dailydabble:v1:analytics-session-id";
const ATTRIBUTION_KEY = "dailydabble:v1:analytics-attribution";
const ONCE_KEY_PREFIX = "dailydabble:v1:analytics-once";

type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

const safeSessionStorage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const getSessionId = () => {
  const storage = safeSessionStorage();
  const existing = storage?.getItem(SESSION_ID_KEY);
  if (existing) return existing;

  const created = window.crypto.randomUUID();
  storage?.setItem(SESSION_ID_KEY, created);
  return created;
};

const getAttribution = (): Attribution => {
  const storage = safeSessionStorage();
  const params = new URLSearchParams(window.location.search);
  const current: Attribution = {
    utmSource: params.get("utm_source")?.slice(0, 100) || undefined,
    utmMedium: params.get("utm_medium")?.slice(0, 100) || undefined,
    utmCampaign: params.get("utm_campaign")?.slice(0, 100) || undefined,
  };

  if (current.utmSource || current.utmMedium || current.utmCampaign) {
    storage?.setItem(ATTRIBUTION_KEY, JSON.stringify(current));
    return current;
  }

  try {
    return JSON.parse(storage?.getItem(ATTRIBUTION_KEY) || "{}") as Attribution;
  } catch {
    return {};
  }
};

export const trackEvent = (input: AnalyticsEventInput) => {
  if (typeof window === "undefined") return;

  try {
    const attribution = getAttribution();
    const payload = JSON.stringify({
      ...input,
      ...attribution,
      eventId: window.crypto.randomUUID(),
      sessionId: getSessionId(),
      pagePath: window.location.pathname,
      referrer: document.referrer || undefined,
    });

    void fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics must never interrupt gameplay.
  }
};

export const trackEventOnce = (onceKey: string, input: AnalyticsEventInput) => {
  if (typeof window === "undefined") return;

  const storage = safeSessionStorage();
  const key = `${ONCE_KEY_PREFIX}:${onceKey}`;
  if (storage?.getItem(key)) return;
  storage?.setItem(key, "1");
  trackEvent(input);
};

export const trackGameStarted = (gameSlug: string, puzzleDate?: string, isArchive = false) => {
  trackEventOnce(`started:${gameSlug}:${puzzleDate || "unknown"}:${isArchive}`, {
    eventName: "game_started",
    gameSlug,
    puzzleDate,
    isArchive,
  });
};
