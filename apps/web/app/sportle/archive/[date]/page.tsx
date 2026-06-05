import SportleGameClient from "../../components/SportleGameClient";

type ArchivePageProps = { params: Promise<{ date?: string }> | { date?: string } };

export default async function ArchivePuzzlePage({ params }: ArchivePageProps) {
  const resolvedParams = await params;
  const date = resolvedParams?.date || "";
  const encoded = encodeURIComponent(date || "");

  return (
    <SportleGameClient
      apiUrl={`/api/sportle/puzzle/by-date?date=${encoded}`}
      navLabel=""
      archiveHref="/sportle/archive"
      storagePrefix={`sportle:v1:archive:${date}`}
      completionPrefix="sportle:v1:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
