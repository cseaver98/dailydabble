import EquadleGameClient from "./components/EquadleGameClient";

export default function HomePage() {
  return <EquadleGameClient apiUrl="/api/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
