import DabbleGameClient from "./components/DabbleGameClient";

export default function HomePage() {
  return <DabbleGameClient apiUrl="/api/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
