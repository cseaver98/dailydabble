type WikipediaSummary = {
  extract: string | null;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
};

const trimSummary = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length <= 260) {
    return normalized;
  }

  const shortened = normalized.slice(0, 257).trimEnd();
  return `${shortened}...`;
};

const fetchWikipediaSummary = async (title: string): Promise<WikipediaSummary | null> => {
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    {
      headers: {
        "Api-User-Agent": "Agegaple/1.0 (editorial content)",
      },
      next: { revalidate: 86_400 },
    },
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as WikipediaSummary;
};

export const getWikipediaSummary = async (
  preferredTitle: string | null | undefined,
  fallbackTitle: string,
): Promise<{ summary: string | null; pageUrl: string | null }> => {
  const candidates = [preferredTitle?.trim(), fallbackTitle.trim()].filter(
    (value, index, items): value is string => Boolean(value) && items.indexOf(value) === index,
  );

  for (const candidate of candidates) {
    try {
      const summary = await fetchWikipediaSummary(candidate);
      if (!summary) {
        continue;
      }

      return {
        summary: trimSummary(summary.extract ?? null),
        pageUrl: summary.content_urls?.desktop?.page ?? null,
      };
    } catch {
      continue;
    }
  }

  return {
    summary: null,
    pageUrl: null,
  };
};
