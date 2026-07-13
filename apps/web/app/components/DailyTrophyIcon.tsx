import Image from "next/image";

type DailyTrophyIconProps = {
  className?: string;
};

export default function DailyTrophyIcon({ className = "h-20 w-20" }: DailyTrophyIconProps) {
  return (
    <Image
      src="/icons/daily-trophy.png"
      alt=""
      aria-hidden="true"
      width={512}
      height={512}
      className={`object-contain ${className}`}
    />
  );
}
