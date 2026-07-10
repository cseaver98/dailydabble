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
  const approximateNextMidnight = Date.UTC(year, month - 1, day + 1);
  const offsetLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
  }).formatToParts(approximateNextMidnight).find((part) => part.type === "timeZoneName")?.value;
  const offsetMatch = offsetLabel?.match(/GMT([+-])(\d{2}):(\d{2})/);
  const offsetMinutes = offsetMatch
    ? (offsetMatch[1] === "+" ? 1 : -1) * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]))
    : -240;
  const nextMidnightUtc = approximateNextMidnight - offsetMinutes * 60_000;
  const diffMs = Math.max(0, nextMidnightUtc - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

export const useNextGameCountdown = (isActive: boolean) => {
  const [timestamp, setTimestamp] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const updateTimestamp = () => setTimestamp(Date.now());
    const initialTimeoutId = window.setTimeout(updateTimestamp, 0);
    const intervalId = window.setInterval(updateTimestamp, 1000);
    return () => {
      window.clearTimeout(initialTimeoutId);
      window.clearInterval(intervalId);
    };
  }, [isActive]);

  return useMemo(() => (isActive && timestamp !== null ? getNextGameCountdown(timestamp) : ""), [isActive, timestamp]);
};
