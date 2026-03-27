import EquadleGameClient from "../../components/EquadleGameClient";

export default async function ArchivePuzzlePage({ params }) {
  const resolvedParams = await params;
  const date = resolvedParams?.date || "";
  const encoded = encodeURIComponent(date || "");

  return (
    <EquadleGameClient
      apiUrl={`/api/puzzle/by-date?date=${encoded}`}
      navLabel={`Archive game: ${date || "loading..."}`}
      archiveHref="/archive"
      storagePrefix={`equadle:v1:archive:${date}`}
      completionPrefix="equadle:v1:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
