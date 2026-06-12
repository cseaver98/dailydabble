import AgegapleGameClient from "../../components/AgegapleGameClient";

type ArchivePageProps = { params: Promise<{ date?: string }> | { date?: string } };

export default async function ArchivePuzzlePage({ params }: ArchivePageProps) {
  const resolvedParams = await params;
  const date = resolvedParams?.date || "";
  const encoded = encodeURIComponent(date);

  return (
    <AgegapleGameClient
      apiUrl={`/api/agegaple/puzzle/by-date?date=${encoded}`}
      archiveHref="/agegaple/archive"
      storagePrefix={`agegaple:v1:archive-progress:${date}`}
      lockDailyCompletion={false}
    />
  );
}
