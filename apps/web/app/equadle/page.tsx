import EquadleGameClient from "./components/EquadleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import GameSeoContent from "../components/GameSeoContent";
import { getAccountAccess } from "@/lib/account-access";
import { buildGameMetadata } from "@/lib/game-seo";

export const metadata = buildGameMetadata("equadle");

export default async function HomePage() {
  const access = await getAccountAccess("equadle");
  const game = <EquadleGameClient apiUrl="/api/equadle/puzzle/today" navLabel="" hideToday lockDailyCompletion />;

  return (
    <>
      {access.locked ? <GameAccountGate gameName="Equadle">{game}</GameAccountGate> : game}
      <GameSeoContent slug="equadle" />
    </>
  );
}
