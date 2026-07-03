const handledCrawlFailureMessages = [
  "source_url is empty",
  "dns resolution failed",
  "could not be translated to an ip address",
  "remote name could not be resolved",
  "name could not be resolved",
  "getaddrinfo",
  "enotfound",
  "invalid url",
  "target page returned http",
  "target page scrape error",
  "scraped page appears to be an http error page",
  "scraped content is empty",
];

type ScrapeMetadata = Record<string, unknown> | null | undefined;

export function getCrawlFailureMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function isHandledCrawlFailure(error: unknown) {
  const message = getCrawlFailureMessage(error).toLowerCase();

  return handledCrawlFailureMessages.some((pattern) =>
    message.includes(pattern),
  );
}

export function getCrawlFailureHttpStatus(error: unknown) {
  return isHandledCrawlFailure(error) ? 200 : 500;
}

export function getScrapeStatusCode(metadata: ScrapeMetadata) {
  const value = metadata?.statusCode ?? metadata?.status_code;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

export function isLikelyHttpErrorMarkdown(markdown: string) {
  const trimmed = markdown.trim();

  if (!trimmed) {
    return false;
  }

  const normalized = trimmed.replace(/\s+/g, " ");
  const isShortPage = normalized.length <= 1_500;

  if (
    isShortPage &&
    /the requested url .+ was not found on this server/i.test(normalized)
  ) {
    return true;
  }

  if (isShortPage && /errordocument to handle the request/i.test(normalized)) {
    return true;
  }

  return (
    isShortPage &&
    /^#?\s*(404\s+)?not found\b/i.test(trimmed) &&
    /(?:404\s+not\s+found|page\s+not\s+found)/i.test(normalized)
  );
}

export function assertUsableScrapedContent(
  markdown: string,
  metadata: ScrapeMetadata,
) {
  const statusCode = getScrapeStatusCode(metadata);

  if (statusCode !== undefined && statusCode >= 400) {
    throw new Error(`Target page returned HTTP ${statusCode}`);
  }

  const metadataError = metadata?.error;

  if (typeof metadataError === "string" && metadataError.trim()) {
    throw new Error(`Target page scrape error: ${metadataError.trim()}`);
  }

  if (!markdown.trim()) {
    throw new Error("Scraped content is empty");
  }

  if (isLikelyHttpErrorMarkdown(markdown)) {
    throw new Error("Scraped page appears to be an HTTP error page");
  }
}
