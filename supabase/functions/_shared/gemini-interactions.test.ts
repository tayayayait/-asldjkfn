import { describe, expect, it } from "vitest";

import { extractGeminiInteractionText } from "./gemini-interactions";

describe("extractGeminiInteractionText", () => {
  it("reads SDK-style output_text responses", () => {
    expect(
      extractGeminiInteractionText({ output_text: " generated text " }),
    ).toBe("generated text");
  });

  it("reads generateContent candidate text responses", () => {
    expect(
      extractGeminiInteractionText({
        candidates: [
          {
            content: {
              parts: [{ text: "first " }, { text: "second" }],
            },
          },
        ],
      }),
    ).toBe("first second");
  });

  it("reads REST Interactions model_output step text responses", () => {
    expect(
      extractGeminiInteractionText({
        steps: [
          {
            type: "user_input",
            status: "done",
            content: [{ type: "text", text: "prompt" }],
          },
          {
            type: "model_output",
            status: "done",
            content: [{ type: "text", text: "{\"summary\":\"ok\"}" }],
          },
        ],
      }),
    ).toBe("{\"summary\":\"ok\"}");
  });
});
