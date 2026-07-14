import AgegapleGameClient from "./components/AgegapleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import GameSeoContent from "../components/GameSeoContent";
import { getAccountAccess } from "@/lib/account-access";
import { buildGameMetadata } from "@/lib/game-seo";

export const metadata = buildGameMetadata("agegaple");

export default async function HomePage() {
  const access = await getAccountAccess("agegaple");
  const game = <AgegapleGameClient />;

  return (
    <>
      {access.locked ? <GameAccountGate gameName="Agegaple">{game}</GameAccountGate> : game}
      <GameSeoContent slug="agegaple" />
    </>
  );
}
