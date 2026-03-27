import SportleGameClient from "../../components/SportleGameClient";

export default async function ArchivePuzzlePage({ params }) {
  const resolvedParams = await params;
  const date = resolvedParams?.date || "";
  const encoded = encodeURIComponent(date || "");

  return (
    <SportleGameClient
      apiUrl={`/api/puzzle/by-date?date=${encoded}`}
      navLabel={`Archive game: ${date || "loading..."}`}
      archiveHref="/archive"
      storagePrefix={`sportle:v1:archive:${date}`}
      completionPrefix="sportle:v1:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
