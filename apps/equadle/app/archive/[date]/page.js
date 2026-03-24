import EquadleGameClient from "../../components/EquadleGameClient";

export default function ArchivePuzzlePage({ params }) {
  const date = params?.date || "";
  const encoded = encodeURIComponent(date || "");

  return (
    <EquadleGameClient
      apiUrl={`/api/puzzle/by-date?date=${encoded}`}
      navLabel="Archive game"
      archiveHref="/archive"
      storagePrefix={`equadle:v1:archive:${date}`}
      completionPrefix="equadle:v1:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
