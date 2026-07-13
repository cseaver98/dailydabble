type GuessProgressChipProps = {
  used: number;
  total: number;
  active?: boolean;
};

export default function GuessProgressChip({ used, total, active = true }: GuessProgressChipProps) {
  const guessesLeft = Math.max(0, total - used);

  return (
    <span className="chip guess-progress-chip">
      <span>Guesses left: {guessesLeft}</span>
      <span className="guess-progress-bars" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            className={index < used ? "is-used" : active && index === used ? "is-current" : undefined}
            key={index}
          />
        ))}
      </span>
    </span>
  );
}
