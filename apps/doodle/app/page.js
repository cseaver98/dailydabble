import DoodleGameClient from "./components/DoodleGameClient";

export default function HomePage() {
  return <DoodleGameClient apiUrl="/api/puzzle/today" navLabel="Doodle" hideToday />;
}
