import DoodleGameClient from "../../components/DoodleGameClient";

export default function ArchivePuzzlePage({ params }) {
  const date = params?.date || "";
  const encoded = encodeURIComponent(date || "");

  return (
    <DoodleGameClient
      apiUrl={`/api/puzzle/by-date?date=${encoded}`}
      navLabel="Archive game"
      archiveHref="/archive"
      storagePrefix={`doodle:v1:archive:${date}`}
    />
  );
}
