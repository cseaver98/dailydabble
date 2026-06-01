import EquadleGameClient from "../../components/EquadleGameClient";

type ArchivePageProps = { params: Promise<{ date?: string }> | { date?: string } };

export default async function ArchivePuzzlePage({ params }: ArchivePageProps) {
  const resolvedParams = await params;
  const date = resolvedParams?.date || "";
  const encoded = encodeURIComponent(date || "");

  return (
    <EquadleGameClient
      apiUrl={`/api/puzzle/by-date?date=${encoded}`}
      navLabel=""
      archiveHref="/archive"
      storagePrefix={`equadle:v1:archive:${date}`}
      completionPrefix="equadle:v1:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
