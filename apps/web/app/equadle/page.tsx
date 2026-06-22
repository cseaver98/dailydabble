import EquadleGameClient from "./components/EquadleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import { getAccountAccess } from "@/lib/account-access";

export default async function HomePage() {
  const access = await getAccountAccess("equadle");
  if (access.locked) {
    return (
      <GameAccountGate gameName="Equadle">
        <EquadleGameClient apiUrl="/api/equadle/puzzle/today" navLabel="" hideToday lockDailyCompletion />
      </GameAccountGate>
    );
  }

  return <EquadleGameClient apiUrl="/api/equadle/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
