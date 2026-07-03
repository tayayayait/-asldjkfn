import { describe, expect, it } from "vitest";

import {
  buildImagePrompt,
  exportSizeSpecs,
  normalizeAspectRatio,
} from "./images";

describe("image generation helpers", () => {
  it("normalizes common aspect ratio aliases", () => {
    expect(normalizeAspectRatio("1x1")).toBe("1:1");
    expect(normalizeAspectRatio("4:5")).toBe("4:5");
    expect(normalizeAspectRatio("bad")).toBe("1:1");
  });

  it("builds a prompt with preserve and exclude rules", () => {
    const prompt = buildImagePrompt({
      productName: "Celadon Cup",
      keywords: ["celadon", "maehwa"],
      concept: "museum display",
      backgroundTone: "warm neutral",
      preserveRules: ["shape", "logo"],
      excludeElements: ["watermark"],
      customPrompt: "soft side light",
    });

    expect(prompt).toContain("Celadon Cup");
    expect(prompt).toContain("Preserve: shape, logo");
    expect(prompt).toContain("Exclude: watermark");
  });

  it("returns known social export size specs in stable order", () => {
    expect(exportSizeSpecs(["instagram_square", "instagram_story"])).toEqual([
      { key: "instagram_square", width: 1080, height: 1080, label: "Instagram 1:1" },
      { key: "instagram_story", width: 1080, height: 1920, label: "Story 9:16" },
    ]);
  });
});
