import DabbleGameClient from "../../components/DabbleGameClient";

type ArchivePageProps = { params: Promise<{ date?: string }> | { date?: string } };

export default async function ArchivePuzzlePage({ params }: ArchivePageProps) {
  const resolvedParams = await params;
  const date = resolvedParams?.date || "";
  const encoded = encodeURIComponent(date || "");

  return (
    <DabbleGameClient
      apiUrl={`/api/puzzle/by-date?date=${encoded}`}
      navLabel=""
      archiveHref="/archive"
      storagePrefix={`dabble:v1:archive:${date}`}
      completionPrefix="dabble:v1:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
