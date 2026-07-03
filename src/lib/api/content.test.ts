import { describe, expect, it } from "vitest";

import { buildRagContextText, findForbiddenTerms } from "./content";

describe("content generation helpers", () => {
  it("finds forbidden terms with positions", () => {
    expect(findForbiddenTerms("This product is the best and perfect.", [
      "best",
      "perfect",
      "missing",
    ])).toEqual([
      { term: "best", index: 20 },
      { term: "perfect", index: 29 },
    ]);
  });

  it("matches forbidden terms case-insensitively", () => {
    expect(findForbiddenTerms("BEST", ["best"])).toEqual([
      { term: "best", index: 0 },
    ]);
  });

  it("formats retrieved chunks into citeable RAG context text", () => {
    expect(
      buildRagContextText([
        {
          chunk_id: "chunk-1",
          content: "The product uses celadon glazing.",
          similarity: 0.876,
          source_title: "Museum archive",
          source_url: "https://example.com/archive",
        },
      ]),
    ).toContain("[1] score=0.876 source=Museum archive");
  });
});
