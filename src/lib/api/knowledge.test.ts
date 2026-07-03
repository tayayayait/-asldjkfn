import { describe, expect, it } from "vitest";

import {
  chunkTextForEmbedding,
  estimateTokenCount,
  formatEmbeddingForRpc,
  isLowSimilarity,
} from "./knowledge";

describe("chunkTextForEmbedding", () => {
  it("splits long markdown into bounded overlapping chunks", () => {
    const text = [
      "첫 번째 문단은 도입 설명입니다.",
      "두 번째 문단은 전통 문양과 제작 기법을 설명합니다.",
      "세 번째 문단은 소재와 관리 방법을 설명합니다.",
      "네 번째 문단은 현대 기념품 활용 예시입니다.",
    ].join("\n\n");

    const chunks = chunkTextForEmbedding(text, {
      maxChars: 55,
      overlapChars: 12,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.content.length <= 55)).toBe(true);
    expect(chunks[1].content).toContain("제작 기법");
  });

  it("normalizes whitespace and skips empty input", () => {
    expect(chunkTextForEmbedding("  \n\n  ")).toEqual([]);
    expect(chunkTextForEmbedding("  하나\n\n\n둘  ")[0].content).toBe(
      "하나\n\n둘",
    );
  });
});

describe("estimateTokenCount", () => {
  it("estimates Korean text tokens from character length", () => {
    expect(estimateTokenCount("전통문화")).toBe(2);
    expect(estimateTokenCount("")).toBe(0);
  });
});

describe("formatEmbeddingForRpc", () => {
  it("serializes embedding numbers into pgvector input format", () => {
    expect(formatEmbeddingForRpc([0.1, -0.25, 1])).toBe("[0.1,-0.25,1]");
  });

  it("rejects non-finite embedding values", () => {
    expect(() => formatEmbeddingForRpc([0.1, Number.NaN])).toThrow(
      "Embedding contains a non-finite value",
    );
  });
});

describe("isLowSimilarity", () => {
  it("uses 0.55 as the default low-similarity cutoff", () => {
    expect(isLowSimilarity(0.54)).toBe(true);
    expect(isLowSimilarity(0.55)).toBe(false);
  });
});
