"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type LockedArchiveTileProps = {
  href: string;
  tileLabel: string;
  dateLabel: string;
  isLocked: boolean;
};

const CLICK_PATTERN = ["top-left", "top-right", "bottom-left", "bottom-right", "center"] as const;

type ClickZone = (typeof CLICK_PATTERN)[number] | "other";

const getClickZone = (event: React.MouseEvent<HTMLButtonElement>): ClickZone => {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;

  if (x < 1 / 3 && y < 1 / 3) return "top-left";
  if (x > 2 / 3 && y < 1 / 3) return "top-right";
  if (x < 1 / 3 && y > 2 / 3) return "bottom-left";
  if (x > 2 / 3 && y > 2 / 3) return "bottom-right";
  if (x >= 1 / 3 && x <= 2 / 3 && y >= 1 / 3 && y <= 2 / 3) return "center";
  return "other";
};

export default function LockedArchiveTile({
  href,
  tileLabel,
  dateLabel,
  isLocked,
}: LockedArchiveTileProps) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);

  const lockHint = useMemo(() => {
    if (!isLocked) {
      return undefined;
    }
    return stepIndex > 0 ? `Secret pattern progress ${stepIndex} of ${CLICK_PATTERN.length}` : "Locked archive tile";
  }, [isLocked, stepIndex]);

  if (!isLocked) {
    return (
      <Link className="archive-tile" href={href}>
        <span className="archive-tile-title">{tileLabel}</span>
        <span className="archive-tile-date">{dateLabel}</span>
      </Link>
    );
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const zone = getClickZone(event);
    const expected = CLICK_PATTERN[stepIndex];

    if (zone !== expected) {
      setStepIndex(zone === CLICK_PATTERN[0] ? 1 : 0);
      return;
    }

    if (stepIndex === CLICK_PATTERN.length - 1) {
      setStepIndex(0);
      router.push(href);
      return;
    }

    setStepIndex((current) => current + 1);
  };

  return (
    <button
      type="button"
      className="archive-tile is-locked"
      onClick={handleClick}
      aria-label={`${tileLabel} locked archive game`}
      title={lockHint}
    >
      <span className="archive-lock-badge">Locked</span>
      <span className="archive-tile-title">{tileLabel}</span>
      <span className="archive-tile-date">{dateLabel}</span>
    </button>
  );
}
