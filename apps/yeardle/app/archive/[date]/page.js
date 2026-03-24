import YeardleGameClient from "../../components/YeardleGameClient";

export default function ArchivePuzzlePage({ params }) {
  const date = params?.date || "";
  const encoded = encodeURIComponent(date || "");

  return (
    <YeardleGameClient
      apiUrl={`/api/puzzle/by-date?date=${encoded}`}
      navLabel="Archive game"
      archiveHref="/archive"
      storagePrefix={`yeardle:v1:archive:${date}`}
      completionPrefix="yeardle:v1:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
