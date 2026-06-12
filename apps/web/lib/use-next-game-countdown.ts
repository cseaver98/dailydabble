"use client";

import { useEffect, useMemo, useState } from "react";

const getNextGameCountdown = (timestamp: number) => {
  const now = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value || now.getUTCFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value || now.getUTCMonth() + 1);
  const day = Number(parts.find((part) => part.type === "day")?.value || now.getUTCDate());
  const nextMidnightUtc = Date.UTC(year, month - 1, day + 1, 4, 0, 0);
  const diffMs = Math.max(0, nextMidnightUtc - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

export const useNextGameCountdown = (isActive: boolean) => {
  const [timestamp, setTimestamp] = useState(() => Date.now());

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const intervalId = window.setInterval(() => setTimestamp(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [isActive]);

  return useMemo(() => (isActive ? getNextGameCountdown(timestamp) : ""), [isActive, timestamp]);
};
