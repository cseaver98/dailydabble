import DoodleGameClient from "./components/DoodleGameClient";

export default function HomePage() {
  return <DoodleGameClient apiUrl="/api/doodle/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
