import VerbleGameClient from "./components/VerbleGameClient";

export default function HomePage() {
  return <VerbleGameClient apiUrl="/api/verble/puzzle/today" navLabel="" hideToday lockDailyCompletion />;
}
