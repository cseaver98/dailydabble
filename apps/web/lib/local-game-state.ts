"use client";

const gameStatePrefixes = [
  "agegaple:",
  "doodle:",
  "equadle:",
  "moviedle:",
  "sportle:",
  "verble:",
  "yeardle:",
];

export const clearLocalGameState = () => {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && gameStatePrefixes.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
};
