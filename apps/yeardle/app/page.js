import YeardleGameClient from "./components/YeardleGameClient";

export default function HomePage() {
  return <YeardleGameClient apiUrl="/api/puzzle/today" navLabel="Yeardle" hideToday lockDailyCompletion />;
}
