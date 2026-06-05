import YeardleGameClient from "./components/YeardleGameClient";

export default function HomePage() {
  return <YeardleGameClient apiUrl="/api/yeardle/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
