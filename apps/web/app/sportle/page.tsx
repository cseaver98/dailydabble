import SportleGameClient from "./components/SportleGameClient";

export default function HomePage() {
  return <SportleGameClient apiUrl="/api/sportle/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
