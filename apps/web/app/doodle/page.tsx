import DoodleGameClient from "./components/DoodleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import { getAccountAccess } from "@/lib/account-access";

export default async function HomePage() {
  const access = await getAccountAccess("doodle");
  if (access.locked) {
    return (
      <GameAccountGate gameName="Doodle">
        <DoodleGameClient apiUrl="/api/doodle/puzzle/today" navLabel="" hideToday lockDailyCompletion />
      </GameAccountGate>
    );
  }

  return <DoodleGameClient apiUrl="/api/doodle/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
