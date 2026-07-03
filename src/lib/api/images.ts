import { supabase } from "@/lib/supabase/client";
import { resolveUserIdOrDemo } from "@/lib/auth/demo-user";
import type { Database } from "@/lib/supabase/database.types";
import type { Product } from "./products";

export type ProductAsset =
  Database["public"]["Tables"]["product_assets"]["Row"];
export type ImageGeneration =
  Database["public"]["Tables"]["image_generations"]["Row"];
export type ImageGenerationStatus = ImageGeneration["status"];
export type ImageProduct = Pick<Product, "id" | "sku" | "name_ko">;

export type ProductAssetWithUrl = ProductAsset & {
  signedUrl?: string | null;
};

export type ImageGenerationWithRelations = ImageGeneration & {
  products?: ImageProduct | null;
  product_assets?: Pick<ProductAsset, "id" | "file_name" | "file_path"> | null;
  signedUrl?: string | null;
  thumbnailUrl?: string | null;
};

export type UploadProductImageParams = {
  productId: string;
  file: File;
  width?: number | null;
  height?: number | null;
  isPrimary?: boolean;
};

export type GenerateImageParams = {
  productId: string;
  originalAssetId?: string;
  concept: string;
  backgroundTone?: string;
  aspectRatio: string;
  preserveRules: string[];
  excludeElements: string[];
  customPrompt?: string;
};

export type ImageGenerationFilters = {
  productId?: string | "all";
  status?: ImageGenerationStatus | "all";
  aspectRatio?: string | "all";
  concept?: string | "all";
  page?: number;
  pageSize?: number;
};

export type ExportSizeKey =
  | "instagram_square"
  | "instagram_portrait"
  | "instagram_story"
  | "wide";

export type ExportSizeSpec = {
  key: ExportSizeKey;
  width: number;
  height: number;
  label: string;
};

type ReviewAction = Extract<ImageGenerationStatus, "approved" | "rejected">;

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;
const ASPECT_RATIOS = new Set(["1:1", "4:5", "9:16", "16:9"]);
const exportSizes: Record<ExportSizeKey, ExportSizeSpec> = {
  instagram_square: {
    key: "instagram_square",
    width: 1080,
    height: 1080,
    label: "Instagram 1:1",
  },
  instagram_portrait: {
    key: "instagram_portrait",
    width: 1080,
    height: 1350,
    label: "Instagram 4:5",
  },
  instagram_story: {
    key: "instagram_story",
    width: 1080,
    height: 1920,
    label: "Story 9:16",
  },
  wide: {
    key: "wide",
    width: 1920,
    height: 1080,
    label: "Wide 16:9",
  },
};

export const IMAGE_STATUS_LABELS: Record<ImageGenerationStatus, string> = {
  uploaded: "업로드",
  preprocessing: "전처리",
  ready: "준비",
  generating: "생성 중",
  generated: "생성 완료",
  review_pending: "검수 대기",
  approved: "승인",
  rejected: "반려",
  exported: "내보냄",
  failed: "실패",
};

export function normalizeAspectRatio(value: string) {
  const normalized = value.trim().replace("x", ":");

  return ASPECT_RATIOS.has(normalized) ? normalized : "1:1";
}

export function buildImagePrompt(input: {
  productName: string;
  keywords: string[];
  concept: string;
  backgroundTone?: string;
  preserveRules: string[];
  excludeElements: string[];
  customPrompt?: string;
}) {
  return [
    `Product: ${input.productName}`,
    `Cultural keywords: ${input.keywords.join(", ") || "none"}`,
    `Concept: ${input.concept}`,
    `Background tone: ${input.backgroundTone || "neutral"}`,
    `Preserve: ${input.preserveRules.join(", ") || "product identity"}`,
    `Exclude: ${input.excludeElements.join(", ") || "none"}`,
    "Create a premium product image for a Korean traditional culture souvenir. Do not add text, watermark, or fake logos.",
    input.customPrompt?.trim() ? `Additional prompt: ${input.customPrompt.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function exportSizeSpecs(keys: ExportSizeKey[]) {
  return keys.map((key) => exportSizes[key]).filter(Boolean);
}

export async function uploadProductImage(params: UploadProductImageParams) {
  const safeName = params.file.name.replace(/[^A-Za-z0-9_.-]/g, "_");
  const filePath = `products/${params.productId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("product-originals")
    .upload(filePath, params.file, {
      cacheControl: "3600",
      contentType: params.file.type,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error } = await supabase
    .from("product_assets")
    .insert({
      product_id: params.productId,
      asset_type: "original",
      file_path: filePath,
      file_name: params.file.name,
      file_size: params.file.size,
      mime_type: params.file.type,
      width: params.width ?? null,
      height: params.height ?? null,
      is_primary: params.isPrimary ?? true,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return withAssetSignedUrl(data);
}

export async function fetchProductAssets(productId?: string) {
  if (!productId) {
    return [] as ProductAssetWithUrl[];
  }

  const { data, error } = await supabase
    .from("product_assets")
    .select("*")
    .eq("product_id", productId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return Promise.all((data ?? []).map(withAssetSignedUrl));
}

export async function fetchImageGenerations(
  filters: ImageGenerationFilters = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  let query = supabase
    .from("image_generations")
    .select(
      "*, products(id, sku, name_ko), product_assets(id, file_name, file_path)",
      { count: "exact" },
    );

  if (filters.productId && filters.productId !== "all") {
    query = query.eq("product_id", filters.productId);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.aspectRatio && filters.aspectRatio !== "all") {
    query = query.eq("aspect_ratio", normalizeAspectRatio(filters.aspectRatio));
  }

  if (filters.concept && filters.concept !== "all") {
    query = query.eq("concept", filters.concept);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as ImageGenerationWithRelations[];

  return {
    data: await Promise.all(rows.map(withImageSignedUrls)),
    count: count ?? 0,
    page,
    pageSize,
  };
}

export async function generateImage(params: GenerateImageParams) {
  const { data, error } = await supabase.functions.invoke("generate-image", {
    body: {
      product_id: params.productId,
      original_asset_id: params.originalAssetId,
      concept: params.concept,
      background_tone: params.backgroundTone,
      aspect_ratio: normalizeAspectRatio(params.aspectRatio),
      preserve_rules: params.preserveRules,
      exclude_elements: params.excludeElements,
      custom_prompt: params.customPrompt,
    },
  });

  if (error) {
    throw error;
  }

  const payload = data as {
    ok?: boolean;
    data?: ImageGenerationWithRelations;
    error?: string;
  };

  if (payload && typeof payload === "object" && "ok" in payload) {
    if (payload.ok === false) {
      throw new Error(payload.error ?? "Image generation failed");
    }

    if (!payload.data) {
      throw new Error("Image generation response did not include data");
    }

    return withImageSignedUrls(payload.data);
  }

  return withImageSignedUrls(data as ImageGenerationWithRelations);
}

export async function exportImage(id: string, sizes: ExportSizeKey[]) {
  const { data, error } = await supabase.functions.invoke(
    "resize-export-image",
    {
      body: {
        image_generation_id: id,
        sizes,
      },
    },
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function downloadImage(path: string) {
  const { data, error } = await supabase.storage
    .from("generated-images")
    .createSignedUrl(path, 60 * 10);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

async function getReviewerId() {
  const { data, error } = await supabase.auth.getUser();

  return resolveUserIdOrDemo(data.user, error);
}

async function reviewImage(id: string, action: ReviewAction, note?: string) {
  const reviewerId = await getReviewerId();
  const { data: current, error: currentError } = await supabase
    .from("image_generations")
    .select("status")
    .eq("id", id)
    .single();

  if (currentError) {
    throw currentError;
  }

  const { data, error } = await supabase
    .from("image_generations")
    .update({
      status: action,
      reviewer_id: reviewerId,
      review_note: note?.trim() || null,
      approved_at: action === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select(
      "*, products(id, sku, name_ko), product_assets(id, file_name, file_path)",
    )
    .single();

  if (error) {
    throw error;
  }

  const { error: reviewEventError } = await supabase
    .from("review_events")
    .insert({
      target_type: "image",
      target_id: id,
      action,
      reviewer_id: reviewerId,
      note: note?.trim() || null,
      previous_status: current.status,
      new_status: action,
    });

  if (reviewEventError) {
    throw reviewEventError;
  }

  if (action === "approved") {
    await supabase
      .from("products")
      .update({ status: "image_ready" })
      .eq("id", data.product_id);
  }

  return withImageSignedUrls(data as unknown as ImageGenerationWithRelations);
}

export function approveImage(id: string, note?: string) {
  return reviewImage(id, "approved", note);
}

export function rejectImage(id: string, note: string) {
  return reviewImage(id, "rejected", note);
}

async function withAssetSignedUrl(asset: ProductAsset) {
  const { data } = await supabase.storage
    .from("product-originals")
    .createSignedUrl(asset.file_path, 60 * 10);

  return {
    ...asset,
    signedUrl: data?.signedUrl ?? null,
  } satisfies ProductAssetWithUrl;
}

async function withImageSignedUrls(image: ImageGenerationWithRelations) {
  const [imageUrl, thumbnailUrl] = await Promise.all([
    image.generated_file_path
      ? signedGeneratedUrl(image.generated_file_path)
      : Promise.resolve(null),
    image.thumbnail_path
      ? signedGeneratedUrl(image.thumbnail_path)
      : Promise.resolve(null),
  ]);

  return {
    ...image,
    signedUrl: imageUrl,
    thumbnailUrl,
  } satisfies ImageGenerationWithRelations;
}

async function signedGeneratedUrl(path: string) {
  const { data } = await supabase.storage
    .from("generated-images")
    .createSignedUrl(path, 60 * 10);

  return data?.signedUrl ?? null;
}
