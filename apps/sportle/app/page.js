import SportleGameClient from "./components/SportleGameClient";

export default function HomePage() {
  return <SportleGameClient apiUrl="/api/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
