import { describe, expect, it } from "vitest";

import {
  assertUsableScrapedContent,
  getCrawlFailureHttpStatus,
  getCrawlFailureMessage,
  getScrapeStatusCode,
  isLikelyHttpErrorMarkdown,
  isHandledCrawlFailure,
} from "./crawl-errors";

describe("isHandledCrawlFailure", () => {
  it("treats Firecrawl DNS failures as source-specific crawl failures", () => {
    expect(
      isHandledCrawlFailure(
        new Error(
          'DNS resolution failed for hostname "sunday.joins.com". This means the domain name could not be translated to an IP address.',
        ),
      ),
    ).toBe(true);
  });

  it("treats missing source URLs as source-specific crawl failures", () => {
    expect(isHandledCrawlFailure(new Error("source_url is empty"))).toBe(true);
  });

  it("treats target HTTP errors as source-specific crawl failures", () => {
    expect(
      isHandledCrawlFailure(new Error("Target page returned HTTP 404")),
    ).toBe(true);
  });

  it("does not hide server configuration failures as crawl failures", () => {
    expect(isHandledCrawlFailure(new Error("Missing FIRECRAWL_API_KEY"))).toBe(
      false,
    );
  });
});

describe("getCrawlFailureMessage", () => {
  it("returns the original Error message", () => {
    expect(getCrawlFailureMessage(new Error("Firecrawl API 403"))).toBe(
      "Firecrawl API 403",
    );
  });
});

describe("getCrawlFailureHttpStatus", () => {
  it("returns 200 for handled source crawl failures", () => {
    expect(
      getCrawlFailureHttpStatus(
        new Error('DNS resolution failed for hostname "sunday.joins.com".'),
      ),
    ).toBe(200);
  });

  it("returns 500 for server failures", () => {
    expect(getCrawlFailureHttpStatus(new Error("Missing FIRECRAWL_API_KEY"))).toBe(
      500,
    );
  });
});

describe("getScrapeStatusCode", () => {
  it("reads Firecrawl target status codes from metadata", () => {
    expect(getScrapeStatusCode({ statusCode: 404 })).toBe(404);
    expect(getScrapeStatusCode({ status_code: "403" })).toBe(403);
  });

  it("ignores missing or invalid status codes", () => {
    expect(getScrapeStatusCode({})).toBeUndefined();
    expect(getScrapeStatusCode({ statusCode: "unknown" })).toBeUndefined();
  });
});

describe("isLikelyHttpErrorMarkdown", () => {
  it("detects Apache 404 pages converted to markdown", () => {
    expect(
      isLikelyHttpErrorMarkdown(`# Not Found

The requested URL /news/articleView.html was not found on this server.

Additionally, a 404 Not Found
error was encountered while trying to use an ErrorDocument to handle the
request.`),
    ).toBe(true);
  });

  it("does not reject normal articles that mention 404", () => {
    expect(
      isLikelyHttpErrorMarkdown(
        "A service team documented how a 404 Not Found incident was resolved after deployment.",
      ),
    ).toBe(false);
  });
});

describe("assertUsableScrapedContent", () => {
  it("rejects target HTTP error status from Firecrawl metadata", () => {
    expect(() =>
      assertUsableScrapedContent("article body", { statusCode: 404 }),
    ).toThrow("Target page returned HTTP 404");
  });

  it("rejects markdown that is an HTTP error page", () => {
    expect(() =>
      assertUsableScrapedContent("# 404 Not Found\n\nPage not found.", {}),
    ).toThrow("Scraped page appears to be an HTTP error page");
  });
});
