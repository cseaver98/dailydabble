import EquadleGameClient from "../../components/EquadleGameClient";

type ArchivePageProps = { params: Promise<{ date?: string }> | { date?: string } };

export default async function ArchivePuzzlePage({ params }: ArchivePageProps) {
  const resolvedParams = await params;
  const date = resolvedParams?.date || "";
  const encoded = encodeURIComponent(date || "");

  return (
    <EquadleGameClient
      apiUrl={`/api/equadle/puzzle/by-date?date=${encoded}`}
      navLabel=""
      archiveHref="/equadle/archive"
      storagePrefix={`equadle:v2:archive:${date}`}
      completionPrefix="equadle:v2:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
