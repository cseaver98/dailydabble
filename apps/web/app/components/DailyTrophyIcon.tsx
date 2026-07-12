type DailyTrophyIconProps = {
  className?: string;
};

export default function DailyTrophyIcon({ className = "h-20 w-20" }: DailyTrophyIconProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <path d="M29 17h38v18c0 14-8 25-19 25S29 49 29 35V17Z" fill="#e9b937" stroke="#7d5108" strokeWidth="3" />
      <path d="M36 21h9v28c-6-2-9-8-9-16V21Z" fill="#fff2a8" opacity=".72" />
      <path d="M29 24H17v8c0 11 7 18 18 19M67 24h12v8c0 11-7 18-18 19" fill="none" stroke="#b87c0a" strokeWidth="6" strokeLinecap="round" />
      <path d="M48 60v12M34 82h28M39 72h18v10H39z" fill="#d99e22" stroke="#7d5108" strokeWidth="3" strokeLinejoin="round" />
      <path d="m48 27 3 6 7 .9-5 4.8 1.3 6.8L48 42l-6.3 3.5 1.3-6.8-5-4.8 7-.9 3-6Z" fill="#fff6c8" />
    </svg>
  );
}
