import YeardleGameClient from "../../components/YeardleGameClient";

export default async function ArchivePuzzlePage({ params }) {
  const resolvedParams = await params;
  const date = resolvedParams?.date || "";
  const encoded = encodeURIComponent(date || "");

  return (
    <YeardleGameClient
      apiUrl={`/api/puzzle/by-date?date=${encoded}`}
      navLabel={`Archive game: ${date || "loading..."}`}
      archiveHref="/archive"
      storagePrefix={`yeardle:v1:archive:${date}`}
      completionPrefix="yeardle:v1:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
