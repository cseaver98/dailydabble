type DailyDabbleWordmarkProps = {
  plus?: boolean;
  className?: string;
  plusClassName?: string;
};

export default function DailyDabbleWordmark({
  plus = false,
  className = "",
  plusClassName = "",
}: DailyDabbleWordmarkProps) {
  return (
    <span className={`font-headline inline-flex items-baseline whitespace-nowrap font-black tracking-[-0.04em] text-[#2f672d] ${className}`.trim()}>
      <span>DailyDabble</span>
      {plus ? (
        <span
          aria-label="plus"
          className={`ml-[0.04em] inline-block translate-y-[-0.16em] text-[1.24em] leading-none text-[#b8860b] [-webkit-text-stroke:0.018em_rgba(184,134,11,0.72)] ${plusClassName}`.trim()}
        >
          +
        </span>
      ) : null}
    </span>
  );
}
