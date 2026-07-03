import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ImageGallery } from "./image-gallery";
import type { ImageGenerationWithRelations } from "@/lib/api/images";

describe("ImageGallery", () => {
  it("renders gallery actions without nested buttons", () => {
    const markup = renderToStaticMarkup(
      <ImageGallery
        images={[sampleImage]}
        selectedImageId={sampleImage.id}
        onSelectImage={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(hasNestedButton(markup)).toBe(false);
  });
});

function hasNestedButton(markup: string) {
  const buttonTokens = markup.match(/<\/?button\b[^>]*>/g) ?? [];
  let depth = 0;

  for (const token of buttonTokens) {
    if (token.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      continue;
    }

    depth += 1;
    if (depth > 1) {
      return true;
    }
  }

  return false;
}

const sampleImage = {
  id: "image-1",
  product_id: "product-1",
  concept: "Museum catalog shot",
  status: "generated",
  aspect_ratio: "1:1",
  created_at: "2026-07-01T00:00:00.000Z",
  signedUrl: "https://example.com/image.jpg",
  thumbnailUrl: "https://example.com/thumb.jpg",
  products: {
    id: "product-1",
    sku: "SKU-1",
    name_ko: "청자 컵",
  },
} as ImageGenerationWithRelations;
