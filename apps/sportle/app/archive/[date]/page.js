import SportleGameClient from "../../components/SportleGameClient";

export default function ArchivePuzzlePage({ params }) {
  const date = params?.date || "";
  const encoded = encodeURIComponent(date || "");

  return (
    <SportleGameClient
      apiUrl={`/api/puzzle/by-date?date=${encoded}`}
      navLabel="Archive game"
      archiveHref="/archive"
      storagePrefix={`sportle:v1:archive:${date}`}
      completionPrefix="sportle:v1:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
