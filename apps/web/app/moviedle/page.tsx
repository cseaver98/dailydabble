import MoviedleGameClient from "./components/MoviedleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import GameSeoContent from "../components/GameSeoContent";
import { getAccountAccess } from "@/lib/account-access";
import { buildGameMetadata } from "@/lib/game-seo";

export const metadata = buildGameMetadata("moviedle");

export default async function HomePage() {
  const access = await getAccountAccess("moviedle");
  const game = <MoviedleGameClient apiUrl="/api/moviedle/puzzle/today" navLabel="" hideToday lockDailyCompletion />;

  return (
    <>
      {access.locked ? <GameAccountGate gameName="Moviedle">{game}</GameAccountGate> : game}
      <GameSeoContent slug="moviedle" />
    </>
  );
}
