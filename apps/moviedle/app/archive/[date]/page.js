import MoviedleGameClient from "../../components/MoviedleGameClient";

export default async function ArchiveDatePage({ params }) {
  const resolved = await params;
  const date = resolved?.date || "";
  const encoded = encodeURIComponent(date);

  return (
    <MoviedleGameClient
      apiUrl={`/api/puzzle/by-date?date=${encoded}`}
      navLabel="Moviedle archive"
      archiveHref="/archive"
      storagePrefix={`moviedle:v1:archive:${date}`}
      completionPrefix="moviedle:v1:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
