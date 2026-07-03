import { describe, expect, it } from "vitest";

import { canRetryJob, normalizeJobFilters } from "./jobs";

describe("job helpers", () => {
  it("allows retry only for failed jobs below max attempts", () => {
    expect(canRetryJob({ status: "failed", attempt: 1, max_attempts: 3 })).toBe(
      true,
    );
    expect(canRetryJob({ status: "failed", attempt: 3, max_attempts: 3 })).toBe(
      false,
    );
    expect(canRetryJob({ status: "running", attempt: 0, max_attempts: 3 })).toBe(
      false,
    );
  });

  it("normalizes filters and pagination", () => {
    expect(normalizeJobFilters({ page: -1, pageSize: 999, status: "all" })).toEqual({
      page: 1,
      pageSize: 100,
      from: 0,
      to: 99,
    });
  });
});
