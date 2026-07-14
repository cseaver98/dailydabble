import VerbleGameClient from "./components/VerbleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import GameSeoContent from "../components/GameSeoContent";
import { getAccountAccess } from "@/lib/account-access";
import { buildGameMetadata } from "@/lib/game-seo";

export const metadata = buildGameMetadata("verble");

export default async function HomePage() {
  const access = await getAccountAccess("verble");
  const game = <VerbleGameClient apiUrl="/api/verble/puzzle/today" navLabel="" hideToday lockDailyCompletion />;

  return (
    <>
      {access.locked ? <GameAccountGate gameName="Verble">{game}</GameAccountGate> : game}
      <GameSeoContent slug="verble" />
    </>
  );
}
