import YeardleGameClient from "./components/YeardleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import GameSeoContent from "../components/GameSeoContent";
import { getAccountAccess } from "@/lib/account-access";
import { buildGameMetadata } from "@/lib/game-seo";

export const metadata = buildGameMetadata("yeardle");

export default async function HomePage() {
  const access = await getAccountAccess("yeardle");
  const game = <YeardleGameClient apiUrl="/api/yeardle/puzzle/today" navLabel="" hideToday lockDailyCompletion />;

  return (
    <>
      {access.locked ? <GameAccountGate gameName="Yeardle">{game}</GameAccountGate> : game}
      <GameSeoContent slug="yeardle" />
    </>
  );
}
