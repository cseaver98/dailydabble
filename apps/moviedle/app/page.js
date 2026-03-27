import MoviedleGameClient from "./components/MoviedleGameClient";

export default function HomePage() {
  return <MoviedleGameClient apiUrl="/api/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
