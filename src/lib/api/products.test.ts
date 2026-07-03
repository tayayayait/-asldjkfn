import { describe, expect, it } from "vitest";

import {
  normalizeProductFilters,
  parseProductsCsvText,
  splitProductListValue,
} from "./products";

describe("product API helpers", () => {
  it("normalizes pagination, sort, and search filters", () => {
    expect(
      normalizeProductFilters({
        page: 2,
        pageSize: 20,
        search: "  청자  ",
        sortBy: "not_allowed",
        sortOrder: "asc",
      }),
    ).toEqual({
      page: 2,
      pageSize: 20,
      from: 20,
      to: 39,
      search: "청자",
      sortBy: "updated_at",
      sortOrder: "asc",
    });
  });

  it("splits material and keyword values from comma or newline separated text", () => {
    expect(splitProductListValue("자개, 목재\n칠, 자개")).toEqual([
      "자개",
      "목재",
      "칠",
    ]);
  });

  it("parses valid product CSV rows into insert payloads", () => {
    const result = parseProductsCsvText(
      "sku,name_ko,category,materials,cultural_keywords\nKCT-101,청자 컵,다기,\"도자기, 유약\",\"청자, 다례\"",
    );

    expect(result.products).toEqual([
      {
        sku: "KCT-101",
        name_ko: "청자 컵",
        category: "다기",
        materials: ["도자기", "유약"],
        cultural_keywords: ["청자", "다례"],
      },
    ]);
    expect(result.errors).toEqual([]);
  });

  it("reports missing required CSV fields with row numbers", () => {
    const result = parseProductsCsvText(
      "sku,name_ko,category\nKCT-102,,문구\n,나전 책갈피,",
    );

    expect(result.products).toEqual([]);
    expect(result.errors).toEqual([
      { row: 2, field: "name_ko", message: "필수 입력 항목입니다." },
      { row: 3, field: "sku", message: "필수 입력 항목입니다." },
      { row: 3, field: "category", message: "필수 입력 항목입니다." },
    ]);
  });
});
