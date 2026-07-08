type CommonsExtMetadataValue = {
  value?: string;
};

type CommonsImageInfo = {
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, CommonsExtMetadataValue>;
};

type CommonsImageInfoPage = {
  title?: string;
  imageinfo?: CommonsImageInfo[];
};

type CommonsImageInfoResponse = {
  query?: {
    pages?: Record<string, CommonsImageInfoPage>;
  };
};

export type CommonsImageMetadata = {
  fileTitle: string;
  imageUrl: string;
  thumbUrl: string | null;
  sourcePageUrl: string;
  license: string | null;
  licenseUrl: string | null;
  author: string | null;
  attributionText: string;
  objectName: string | null;
  credit: string | null;
  dateTimeOriginal: string | null;
  rawMetadata: Record<string, string>;
};

const COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php";
const COMMONS_FILE_PREFIX = "File:";

const stripHtml = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
};

const normalizeFileTitle = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Commons file URL is required");
  }

  const withoutUnderscores = trimmed.replace(/_/g, " ");
  return withoutUnderscores.startsWith(COMMONS_FILE_PREFIX)
    ? withoutUnderscores
    : `${COMMONS_FILE_PREFIX}${withoutUnderscores}`;
};

export const getCommonsFileTitleFromUrl = (value: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return normalizeFileTitle(value);
  }

  if (!parsed.hostname.endsWith("wikimedia.org")) {
    throw new Error("URL must be from Wikimedia Commons");
  }

  const decodedPath = decodeURIComponent(parsed.pathname);
  const wikiFileMatch = decodedPath.match(/\/wiki\/(File:.+)$/);
  if (wikiFileMatch?.[1]) {
    return normalizeFileTitle(wikiFileMatch[1]);
  }

  const uploadFileMatch = decodedPath.match(/\/wikipedia\/commons(?:\/thumb)?\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)(?:\/[^/]+)?$/i);
  if (uploadFileMatch?.[1]) {
    return normalizeFileTitle(uploadFileMatch[1]);
  }

  const titleParam = parsed.searchParams.get("title");
  if (titleParam?.startsWith(COMMONS_FILE_PREFIX)) {
    return normalizeFileTitle(titleParam);
  }

  throw new Error("Could not find a Commons file title in that URL");
};

export const fetchCommonsImageMetadata = async (commonsUrlOrTitle: string): Promise<CommonsImageMetadata> => {
  const fileTitle = getCommonsFileTitleFromUrl(commonsUrlOrTitle);
  const search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    titles: fileTitle,
    iiprop: "url|extmetadata",
    iiurlwidth: "900",
  });

  const response = await fetch(`${COMMONS_API_URL}?${search.toString()}`, {
    headers: {
      "Api-User-Agent": "DailyDabbleAgegapleAdmin/1.0 (image metadata autofill)",
      "User-Agent": "DailyDabbleAgegapleAdmin/1.0 (image metadata autofill)",
    },
    next: { revalidate: 86_400 },
  });

  if (!response.ok) {
    throw new Error(`Commons lookup failed with status ${response.status}`);
  }

  const payload = (await response.json()) as CommonsImageInfoResponse;
  const page = Object.values(payload.query?.pages ?? {})[0];
  const imageInfo = page?.imageinfo?.[0];
  if (!page?.title || !imageInfo?.url) {
    throw new Error("Commons file metadata was not found");
  }

  const extmetadata = imageInfo.extmetadata ?? {};
  const rawMetadata = Object.fromEntries(
    Object.entries(extmetadata).map(([key, item]) => [key, stripHtml(item.value) ?? ""]),
  );
  const artist = stripHtml(extmetadata.Artist?.value);
  const credit = stripHtml(extmetadata.Credit?.value);
  const licenseShortName = stripHtml(extmetadata.LicenseShortName?.value);
  const licenseUrl = stripHtml(extmetadata.LicenseUrl?.value);
  const usageTerms = stripHtml(extmetadata.UsageTerms?.value);
  const objectName = stripHtml(extmetadata.ObjectName?.value);
  const dateTimeOriginal = stripHtml(extmetadata.DateTimeOriginal?.value);
  const sourcePageUrl = imageInfo.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
  const author = artist ?? credit;
  const license = licenseShortName ?? usageTerms;
  const attributionParts = [objectName ?? page.title, author, license].filter(Boolean);

  return {
    fileTitle: page.title,
    imageUrl: imageInfo.url,
    thumbUrl: imageInfo.thumburl ?? null,
    sourcePageUrl,
    license,
    licenseUrl,
    author,
    attributionText: attributionParts.join(" | "),
    objectName,
    credit,
    dateTimeOriginal,
    rawMetadata,
  };
};
