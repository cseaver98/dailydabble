import MoviedleGameClient from "./components/MoviedleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import { getAccountAccess } from "@/lib/account-access";

export default async function HomePage() {
  const access = await getAccountAccess("moviedle");
  if (access.locked) {
    return (
      <GameAccountGate gameName="Moviedle">
        <MoviedleGameClient apiUrl="/api/moviedle/puzzle/today" navLabel="" hideToday lockDailyCompletion />
      </GameAccountGate>
    );
  }

  return <MoviedleGameClient apiUrl="/api/moviedle/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
