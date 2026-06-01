import MoviedleGameClient from "../../components/MoviedleGameClient";

type ArchivePageProps = { params: Promise<{ date?: string }> | { date?: string } };

export default async function ArchiveDatePage({ params }: ArchivePageProps) {
  const resolved = await params;
  const date = resolved?.date || "";
  const encoded = encodeURIComponent(date);

  return (
    <MoviedleGameClient
      apiUrl={`/api/puzzle/by-date?date=${encoded}`}
      navLabel=""
      archiveHref="/archive"
      storagePrefix={`moviedle:v1:archive:${date}`}
      completionPrefix="moviedle:v1:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
