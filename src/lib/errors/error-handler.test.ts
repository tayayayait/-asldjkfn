import { describe, expect, it } from "vitest";

import { handleApiError } from "./error-handler";

describe("handleApiError", () => {
  it("extracts Supabase PostgREST error messages from plain objects", () => {
    expect(
      handleApiError({
        code: "PGRST205",
        message: "Could not find the table 'public.products' in the schema cache",
      }),
    ).toEqual({
      message: "데이터베이스 테이블을 찾을 수 없습니다.",
      detailId: "Supabase 마이그레이션 적용 상태를 확인하세요.",
    });
  });

  it("falls back to Error.message for standard errors", () => {
    expect(handleApiError(new Error("Network request failed")).message).toBe(
      "연결이 불안정합니다.",
    );
  });
});
