import YeardleGameClient from "./components/YeardleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import { getAccountAccess } from "@/lib/account-access";

export default async function HomePage() {
  const access = await getAccountAccess("yeardle");
  if (access.locked) {
    return (
      <GameAccountGate gameName="Yeardle">
        <YeardleGameClient apiUrl="/api/yeardle/puzzle/today" navLabel="" hideToday lockDailyCompletion />
      </GameAccountGate>
    );
  }

  return <YeardleGameClient apiUrl="/api/yeardle/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
