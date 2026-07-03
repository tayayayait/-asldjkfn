import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseInvokeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: supabaseInvokeMock,
    },
  },
}));

import {
  crawlSourceDocument,
  getNextPendingSourceId,
  normalizeSourceUrl,
  stripSearchHighlightTags,
} from "./sources";

beforeEach(() => {
  supabaseInvokeMock.mockReset();
});

describe("stripSearchHighlightTags", () => {
  it("removes Naver search highlight tags without changing text content", () => {
    expect(stripSearchHighlightTags("전통 <b>매듭</b> 장식")).toBe(
      "전통 매듭 장식",
    );
  });
});

describe("normalizeSourceUrl", () => {
  it("removes tracking parameters, hash fragments, and trailing slash for duplicate checks", () => {
    expect(
      normalizeSourceUrl(
        "https://example.com/article/?utm_source=naver&utm_medium=cpc&n_media=27758&id=42#top",
      ),
    ).toBe("https://example.com/article?id=42");
  });

  it("returns a trimmed lowercase fallback when the URL cannot be parsed", () => {
    expect(normalizeSourceUrl("  NOT A URL  ")).toBe("not a url");
  });
});

describe("getNextPendingSourceId", () => {
  it("selects the next pending source after the reviewed source", () => {
    expect(
      getNextPendingSourceId(
        [
          { id: "source-1", status: "review_pending" },
          { id: "source-2", status: "approved" },
          { id: "source-3", status: "review_pending" },
        ],
        "source-1",
      ),
    ).toBe("source-3");
  });

  it("wraps around to the first pending source when there is no later pending item", () => {
    expect(
      getNextPendingSourceId(
        [
          { id: "source-1", status: "review_pending" },
          { id: "source-2", status: "approved" },
          { id: "source-3", status: "approved" },
        ],
        "source-2",
      ),
    ).toBe("source-1");
  });

  it("does not return the current source when no other pending source exists", () => {
    expect(
      getNextPendingSourceId(
        [
          { id: "source-1", status: "review_pending" },
          { id: "source-2", status: "approved" },
        ],
        "source-1",
      ),
    ).toBeUndefined();
  });
});

describe("crawlSourceDocument", () => {
  it("throws the Edge Function response body message for non-2xx errors", async () => {
    const functionError = Object.assign(
      new Error("Edge Function returned a non-2xx status code"),
      {
        context: new Response(
          JSON.stringify({
            error: 'DNS resolution failed for hostname "sunday.joins.com".',
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 500,
          },
        ),
      },
    );

    supabaseInvokeMock.mockResolvedValue({
      data: null,
      error: functionError,
    });

    await expect(crawlSourceDocument("source-1")).rejects.toThrow(
      'DNS resolution failed for hostname "sunday.joins.com".',
    );
  });
});
