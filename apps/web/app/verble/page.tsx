import VerbleGameClient from "./components/VerbleGameClient";
import GameAccountGate from "../components/GameAccountGate";
import { getAccountAccess } from "@/lib/account-access";

export default async function HomePage() {
  const access = await getAccountAccess("verble");
  if (access.locked) {
    return (
      <GameAccountGate gameName="Verble">
        <VerbleGameClient apiUrl="/api/verble/puzzle/today" navLabel="" hideToday lockDailyCompletion />
      </GameAccountGate>
    );
  }

  return <VerbleGameClient apiUrl="/api/verble/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
