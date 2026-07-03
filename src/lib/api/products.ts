import Papa from "papaparse";

import { resolveUserIdOrDemo } from "@/lib/auth/demo-user";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
export type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
export type ProductAsset =
  Database["public"]["Tables"]["product_assets"]["Row"];

export type ProductStatus = Product["status"];

export type ProductFilters = {
  search?: string;
  status?: ProductStatus | "all";
  category?: string;
  hasImage?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type NormalizedProductFilters = Required<
  Pick<ProductFilters, "page" | "pageSize" | "sortBy" | "sortOrder">
> & {
  from: number;
  to: number;
  search?: string;
  status?: ProductStatus;
  category?: string;
  hasImage?: boolean;
};

export type ProductCsvError = {
  row: number;
  field: string;
  message: string;
};

export type ProductCsvParseResult = {
  products: ProductInsert[];
  errors: ProductCsvError[];
};

export type ProductDetail = {
  product: Product;
  assets: ProductAsset[];
  stats: {
    sourceDocuments: number;
    contentGenerations: number;
    imageGenerations: number;
  };
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const SORTABLE_COLUMNS = new Set([
  "sku",
  "name_ko",
  "category",
  "status",
  "created_at",
  "updated_at",
]);

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "초안",
  collecting: "수집중",
  review_required: "검수 필요",
  knowledge_ready: "지식 준비",
  content_ready: "콘텐츠 준비",
  image_ready: "이미지 준비",
  completed: "완료",
  archived: "보관됨",
};

export function normalizeProductFilters(
  filters: ProductFilters = {},
): NormalizedProductFilters {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  const sortBy = SORTABLE_COLUMNS.has(filters.sortBy ?? "")
    ? filters.sortBy!
    : "updated_at";
  const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const search = filters.search?.trim() || undefined;
  const status =
    filters.status && filters.status !== "all" ? filters.status : undefined;
  const category =
    filters.category && filters.category !== "all"
      ? filters.category.trim()
      : undefined;

  return {
    page,
    pageSize,
    from,
    to,
    search,
    sortBy,
    sortOrder,
    status,
    category,
    hasImage: filters.hasImage,
  };
}

export function splitProductListValue(value: unknown) {
  if (typeof value !== "string") {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function readCsvString(row: Record<string, unknown>, field: string) {
  const value = row[field];

  return typeof value === "string" ? value.trim() : "";
}

function csvOptionalString(row: Record<string, unknown>, field: string) {
  const value = readCsvString(row, field);

  return value || undefined;
}

export function parseProductsCsvText(csvText: string): ProductCsvParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const products: ProductInsert[] = [];
  const errors: ProductCsvError[] = [];

  parsed.data.forEach((row, index) => {
    const csvRowNumber = index + 2;
    const sku = readCsvString(row, "sku");
    const nameKo = readCsvString(row, "name_ko");
    const category = readCsvString(row, "category");

    if (!sku) {
      errors.push({
        row: csvRowNumber,
        field: "sku",
        message: "필수 입력 항목입니다.",
      });
    }

    if (!nameKo) {
      errors.push({
        row: csvRowNumber,
        field: "name_ko",
        message: "필수 입력 항목입니다.",
      });
    }

    if (!category) {
      errors.push({
        row: csvRowNumber,
        field: "category",
        message: "필수 입력 항목입니다.",
      });
    }

    if (!sku || !nameKo || !category) {
      return;
    }

    const ownMallUrl = csvOptionalString(row, "own_mall_url");

    products.push({
      sku,
      name_ko: nameKo,
      name_en: csvOptionalString(row, "name_en"),
      name_ja: csvOptionalString(row, "name_ja"),
      name_zh: csvOptionalString(row, "name_zh"),
      category,
      materials: splitProductListValue(row.materials),
      cultural_keywords: splitProductListValue(row.cultural_keywords),
      own_mall_url: ownMallUrl,
      description: csvOptionalString(row, "description"),
    });
  });

  return {
    products,
    errors,
  };
}

function escapePostgrestLike(value: string) {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export async function fetchProducts(filters: ProductFilters = {}) {
  const normalized = normalizeProductFilters(filters);
  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .neq("status", "archived");

  if (normalized.search) {
    const pattern = `%${escapePostgrestLike(normalized.search)}%`;
    query = query.or(
      `name_ko.ilike.${pattern},sku.ilike.${pattern},category.ilike.${pattern}`,
    );
  }

  if (normalized.status) {
    query = query.eq("status", normalized.status);
  }

  if (normalized.category) {
    query = query.eq("category", normalized.category);
  }

  const { data, error, count } = await query
    .order(normalized.sortBy, { ascending: normalized.sortOrder === "asc" })
    .range(normalized.from, normalized.to);

  if (error) {
    throw error;
  }

  return {
    data: data ?? [],
    count: count ?? 0,
    page: normalized.page,
    pageSize: normalized.pageSize,
  };
}

export async function fetchProduct(id: string): Promise<ProductDetail> {
  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  const { data: assets, error: assetsError } = await supabase
    .from("product_assets")
    .select("*")
    .eq("product_id", id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (assetsError) {
    throw assetsError;
  }

  const [
    sourceDocumentsResult,
    contentGenerationsResult,
    imageGenerationsResult,
  ] = await Promise.all([
    supabase
      .from("source_documents")
      .select("*", { count: "exact", head: true })
      .eq("product_id", id),
    supabase
      .from("content_generations")
      .select("*", { count: "exact", head: true })
      .eq("product_id", id),
    supabase
      .from("image_generations")
      .select("*", { count: "exact", head: true })
      .eq("product_id", id),
  ]);

  const countError =
    sourceDocumentsResult.error ??
    contentGenerationsResult.error ??
    imageGenerationsResult.error;

  if (countError) {
    throw countError;
  }

  return {
    product,
    assets: assets ?? [],
    stats: {
      sourceDocuments: sourceDocumentsResult.count ?? 0,
      contentGenerations: contentGenerationsResult.count ?? 0,
      imageGenerations: imageGenerationsResult.count ?? 0,
    },
  };
}

export async function createProduct(data: ProductInsert) {
  const { data: product, error } = await supabase
    .from("products")
    .insert(data)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return product;
}

export async function checkProductSkuExists(sku: string, excludeId?: string) {
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("sku", sku)
    .limit(1);

  if (error) {
    throw error;
  }

  const existing = data?.[0];

  return Boolean(existing && existing.id !== excludeId);
}

export async function updateProduct(id: string, data: ProductUpdate) {
  const { data: product, error } = await supabase
    .from("products")
    .update(data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return product;
}

export async function updateProductStatus(id: string, status: ProductStatus) {
  const product = await updateProduct(id, { status });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  const userId = resolveUserIdOrDemo(user, userError);

  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "product.status_updated",
    target_type: "product",
    target_id: id,
    detail: { status },
  });

  return product;
}

export async function deleteProduct(id: string) {
  return updateProductStatus(id, "archived");
}

export async function importProductsFromCSV(csvText: string) {
  const parsed = parseProductsCsvText(csvText);

  if (parsed.errors.length > 0) {
    return {
      inserted: 0,
      updated: 0,
      errors: parsed.errors,
    };
  }

  const skus = parsed.products.map((product) => product.sku);
  const { data: existingProducts, error: existingError } = await supabase
    .from("products")
    .select("sku")
    .in("sku", skus);

  if (existingError) {
    throw existingError;
  }

  const existingSkus = new Set(existingProducts?.map((product) => product.sku));
  const { data, error } = await supabase
    .from("products")
    .upsert(parsed.products, { onConflict: "sku" })
    .select("sku");

  if (error) {
    throw error;
  }

  return {
    inserted: parsed.products.filter((product) => !existingSkus.has(product.sku))
      .length,
    updated: parsed.products.filter((product) => existingSkus.has(product.sku))
      .length,
    errors: [],
  };
}
