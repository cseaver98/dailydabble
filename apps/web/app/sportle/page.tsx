import SportleGameClient from "./components/SportleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import { getAccountAccess } from "@/lib/account-access";

export default async function HomePage() {
  const access = await getAccountAccess("sportle");
  if (access.locked) {
    return (
      <GameAccountGate gameName="Sportle">
        <SportleGameClient apiUrl="/api/sportle/puzzle/today" navLabel="" hideToday lockDailyCompletion />
      </GameAccountGate>
    );
  }

  return <SportleGameClient apiUrl="/api/sportle/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
