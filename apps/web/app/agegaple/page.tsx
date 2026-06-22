import AgegapleGameClient from "./components/AgegapleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import { getAccountAccess } from "@/lib/account-access";

export default async function HomePage() {
  const access = await getAccountAccess("agegaple");
  if (access.locked) {
    return (
      <GameAccountGate gameName="Agegaple">
        <AgegapleGameClient />
      </GameAccountGate>
    );
  }

  return <AgegapleGameClient />;
}
