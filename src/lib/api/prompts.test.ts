import { describe, expect, it } from "vitest";

import {
  extractPromptVariables,
  nextPromptVersion,
  renderPromptTemplate,
} from "./prompts";

describe("prompt template helpers", () => {
  it("extracts unique variables in first-seen order", () => {
    expect(
      extractPromptVariables(
        "{{product_name}} {{ rag_context }} {{product_name}} {{options.tone}}",
      ),
    ).toEqual(["product_name", "rag_context", "options.tone"]);
  });

  it("renders variables with whitespace-tolerant braces", () => {
    expect(
      renderPromptTemplate("Name: {{ product_name }}", {
        product_name: "Celadon Cup",
      }),
    ).toBe("Name: Celadon Cup");
  });

  it("throws when a template variable is missing", () => {
    expect(() =>
      renderPromptTemplate("Name: {{product_name}}", {}),
    ).toThrow("Missing prompt variable: product_name");
  });

  it("uses the next numeric version after the highest existing version", () => {
    expect(nextPromptVersion([{ version: 1 }, { version: 3 }])).toBe(4);
    expect(nextPromptVersion([])).toBe(1);
  });
});
