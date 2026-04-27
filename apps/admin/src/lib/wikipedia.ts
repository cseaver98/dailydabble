type WikipediaSummary = {
  extract: string | null;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
};

type WikipediaQueryResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        extract?: string;
        fullurl?: string;
        canonicalurl?: string;
      }
    >;
  };
};

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 5000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, init: RequestInit, attempts = 2): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        return response;
      }

      if (RETRYABLE_STATUSES.has(response.status) && attempt < attempts) {
        await sleep(300 * 2 ** (attempt - 1));
        continue;
      }

      throw new Error(`${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown fetch error");
      if (attempt < attempts) {
        await sleep(300 * 2 ** (attempt - 1));
        continue;
      }
    }
  }

  throw lastError ?? new Error("Request failed");
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
  try {
    const normalizedTitle = title.replace(/ /g, "_");
    const response = await fetchWithRetry(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(normalizedTitle)}`,
      {
        headers: {
          "Api-User-Agent": "Agegaple/1.0 (editorial context)",
        },
        next: { revalidate: 86_400 },
      },
    );
    return (await response.json()) as WikipediaSummary;
  } catch {
    return null;
  }
};

const fetchWikipediaSummaryFallback = async (title: string): Promise<WikipediaSummary | null> => {
  try {
    const response = await fetchWithRetry(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info&inprop=url&explaintext=1&exintro=1&redirects=1&titles=${encodeURIComponent(title)}&format=json`,
      {
        headers: {
          "Api-User-Agent": "Agegaple/1.0 (editorial context)",
        },
        next: { revalidate: 86_400 },
      },
      1,
    );
    const payload = (await response.json()) as WikipediaQueryResponse;
    const pages = payload.query?.pages ? Object.values(payload.query.pages) : [];
    const page = pages.find((row) => row && row.title);
    if (!page) {
      return null;
    }
    return {
      extract: page.extract ?? null,
      content_urls: {
        desktop: {
          page: page.fullurl ?? page.canonicalurl ?? undefined,
        },
      },
    };
  } catch {
    return null;
  }
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
      const summary = (await fetchWikipediaSummary(candidate)) ?? (await fetchWikipediaSummaryFallback(candidate));
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
