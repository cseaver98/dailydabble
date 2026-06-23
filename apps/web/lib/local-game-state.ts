"use client";

const gameStatePrefixes = [
  "agegaple:v1:",
  "agegaple:v2:",
  "doodle:v1:",
  "equadle:v1:",
  "moviedle:v1:",
  "sportle:v1:",
  "verble:v1:",
  "yeardle:v1:",
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
