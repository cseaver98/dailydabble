import DoodleGameClient from "../../components/DoodleGameClient";

type ArchivePageProps = { params: Promise<{ date?: string }> | { date?: string } };

export default async function ArchivePuzzlePage({ params }: ArchivePageProps) {
  const resolvedParams = await params;
  const date = resolvedParams?.date || "";
  const encoded = encodeURIComponent(date || "");

  return (
    <DoodleGameClient
      apiUrl={`/api/doodle/puzzle/by-date?date=${encoded}`}
      navLabel=""
      archiveHref="/doodle/archive"
      storagePrefix={`doodle:v1:archive:${date}`}
      completionPrefix="doodle:v1:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
