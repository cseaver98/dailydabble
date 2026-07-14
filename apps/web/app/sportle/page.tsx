import SportleGameClient from "./components/SportleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import GameSeoContent from "../components/GameSeoContent";
import { getAccountAccess } from "@/lib/account-access";
import { buildGameMetadata } from "@/lib/game-seo";

export const metadata = buildGameMetadata("sportle");

export default async function HomePage() {
  const access = await getAccountAccess("sportle");
  const game = <SportleGameClient apiUrl="/api/sportle/puzzle/today" navLabel="" hideToday lockDailyCompletion />;

  return (
    <>
      {access.locked ? <GameAccountGate gameName="Sportle">{game}</GameAccountGate> : game}
      <GameSeoContent slug="sportle" />
    </>
  );
}
