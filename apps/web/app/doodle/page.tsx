import DoodleGameClient from "./components/DoodleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import GameSeoContent from "../components/GameSeoContent";
import { getAccountAccess } from "@/lib/account-access";
import { buildGameMetadata } from "@/lib/game-seo";

export const metadata = buildGameMetadata("doodle");

export default async function HomePage() {
  const access = await getAccountAccess("doodle");
  const game = <DoodleGameClient apiUrl="/api/doodle/puzzle/today" navLabel="" hideToday lockDailyCompletion />;

  return (
    <>
      {access.locked ? <GameAccountGate gameName="Doodle">{game}</GameAccountGate> : game}
      <GameSeoContent slug="doodle" />
    </>
  );
}
