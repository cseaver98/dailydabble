"use client";

import { useEffect, useState, type CSSProperties } from "react";

type ResultOutcomeEffectsProps = {
  didWin: boolean;
};

type ParticleStyle = CSSProperties & Record<`--${string}`, string>;

const celebrationColors = ["#d87093", "#1768a6", "#e03a3e", "#7a5af8", "#0f766e", "#d97b1e", "#c9b900"];

const winParticles: ParticleStyle[] = Array.from({ length: 18 }, (_, index) => {
  const fromLeft = index < 9;
  const lane = index % 9;
  return {
    "--particle-color": celebrationColors[lane % celebrationColors.length],
    "--particle-delay": `${60 + lane * 38}ms`,
    "--particle-origin-x": fromLeft ? "4%" : "96%",
    "--particle-origin-y": `${76 + (lane % 3) * 5}%`,
    "--particle-x": `${(fromLeft ? 1 : -1) * (92 + lane * 20)}px`,
    "--particle-y": `${-142 - (lane % 5) * 42}px`,
    "--particle-rotate": `${(fromLeft ? 1 : -1) * (145 + lane * 37)}deg`,
  };
});

export default function ResultOutcomeEffects({ didWin }: ResultOutcomeEffectsProps) {
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const outcome = didWin ? "win" : "loss";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShouldAnimate(false), 2400);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      className="result-outcome-effects"
      data-animate={shouldAnimate ? "true" : "false"}
      data-outcome={outcome}
      aria-hidden="true"
    >
      {shouldAnimate && didWin ? (
        <div className="result-outcome-particles">
          {winParticles.map((style, index) => (
            <span
              className="result-outcome-particle result-outcome-particle-win"
              key={index}
              style={style}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
