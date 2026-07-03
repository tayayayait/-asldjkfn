import { describe, expect, it } from "vitest";

import { getAllowedNavigationItems } from "./roles";

describe("role based navigation", () => {
  it("limits viewer users to dashboard and read-only content/image sections", () => {
    expect(getAllowedNavigationItems("viewer").map((item) => item.url)).toEqual([
      "/dashboard",
      "/content",
      "/images",
    ]);
  });

  it("adds collection and knowledge sections for reviewers", () => {
    expect(getAllowedNavigationItems("reviewer").map((item) => item.url)).toEqual([
      "/dashboard",
      "/sources",
      "/knowledge",
      "/content",
      "/images",
    ]);
  });

  it("adds generation and prompt sections for editors", () => {
    expect(getAllowedNavigationItems("editor").map((item) => item.url)).toEqual([
      "/dashboard",
      "/sources",
      "/knowledge",
      "/content",
      "/images",
      "/prompts",
    ]);
  });

  it("adds product and job management for managers", () => {
    expect(getAllowedNavigationItems("manager").map((item) => item.url)).toEqual([
      "/dashboard",
      "/products",
      "/sources",
      "/knowledge",
      "/content",
      "/images",
      "/prompts",
      "/jobs",
    ]);
  });

  it("allows admins to access every section", () => {
    expect(getAllowedNavigationItems("admin").map((item) => item.url)).toContain(
      "/users",
    );
    expect(getAllowedNavigationItems("admin").map((item) => item.url)).toContain(
      "/settings",
    );
  });
});
