import YeardleGameClient from "../../components/YeardleGameClient";

type ArchivePageProps = { params: Promise<{ date?: string }> | { date?: string } };

export default async function ArchivePuzzlePage({ params }: ArchivePageProps) {
  const resolvedParams = await params;
  const date = resolvedParams?.date || "";
  const encoded = encodeURIComponent(date || "");

  return (
    <YeardleGameClient
      apiUrl={`/api/yeardle/puzzle/by-date?date=${encoded}`}
      navLabel=""
      archiveHref="/yeardle/archive"
      storagePrefix={`yeardle:v1:archive:${date}`}
      completionPrefix="yeardle:v1:archive-completed"
      lockDailyCompletion={false}
    />
  );
}
