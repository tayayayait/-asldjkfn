import { supabase } from "@/lib/supabase/client";
import { resolveUserIdOrDemo } from "@/lib/auth/demo-user";
import type { Database } from "@/lib/supabase/database.types";
import type { Product } from "./products";

export type SourceDocument =
  Database["public"]["Tables"]["source_documents"]["Row"];
export type SourceDocumentInsert =
  Database["public"]["Tables"]["source_documents"]["Insert"];
export type SourceDocumentStatus = SourceDocument["status"];
export type SourceDocumentType = SourceDocument["source_type"];
export type SourceProduct = Pick<Product, "id" | "sku" | "name_ko">;

export type SourceDocumentWithProduct = SourceDocument & {
  products?: SourceProduct | null;
};

export type SourceDocumentFilters = {
  productId?: string | "all";
  status?: SourceDocumentStatus | "all";
  sourceType?: SourceDocumentType | "all";
  search?: string;
  page?: number;
  pageSize?: number;
};

export type NormalizedSourceDocumentFilters = Required<
  Pick<SourceDocumentFilters, "page" | "pageSize">
> & {
  from: number;
  to: number;
  productId?: string;
  status?: SourceDocumentStatus;
  sourceType?: SourceDocumentType;
  search?: string;
};

export type CollectionSourceType = Extract<
  SourceDocumentType,
  "own_mall" | "naver_web" | "naver_blog" | "naver_news"
>;

export type CreateCollectionJobParams = {
  productIds?: string[];
  sourceTypes: CollectionSourceType[];
  limitPerSource: number;
  query?: string;
};

export type ManualSourceInput = {
  productId: string;
  title: string;
  sourceUrl?: string;
  rawText: string;
  markdown?: string;
  reliabilityScore?: number;
};

type ReviewAction = Extract<
  SourceDocumentStatus,
  "approved" | "approved_with_edit" | "rejected" | "duplicate"
>;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "n_media",
  "n_query",
  "n_rank",
  "n_ad_group",
  "n_keyword_id",
]);

export const SOURCE_STATUS_LABELS: Record<SourceDocumentStatus, string> = {
  queued: "대기",
  fetching: "수집 중",
  fetched: "수집 완료",
  parse_failed: "파싱 실패",
  review_pending: "검수 대기",
  approved: "승인",
  approved_with_edit: "수정 승인",
  rejected: "반려",
  duplicate: "중복",
};

export const SOURCE_TYPE_LABELS: Record<SourceDocumentType, string> = {
  own_mall: "자사몰",
  naver_web: "Naver 웹문서",
  naver_blog: "Naver 블로그",
  naver_news: "Naver 뉴스",
  manual: "수동 입력",
};

export const COLLECTION_SOURCE_TYPE_LABELS: Record<CollectionSourceType, string> =
  {
    own_mall: "자사몰",
    naver_web: "Naver 웹문서",
    naver_blog: "Naver 블로그",
    naver_news: "Naver 뉴스",
  };

export function stripSearchHighlightTags(value: string) {
  return value.replace(/<\/?b>/gi, "").replace(/\s+/g, " ").trim();
}

export function normalizeSourceUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";

    for (const key of Array.from(url.searchParams.keys())) {
      if (key.startsWith("utm_") || TRACKING_PARAMS.has(key)) {
        url.searchParams.delete(key);
      }
    }

    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return trimmed.toLowerCase();
  }
}

export function getNextPendingSourceId(
  sources: Array<Pick<SourceDocument, "id" | "status">>,
  currentId: string,
) {
  if (sources.length === 0) {
    return undefined;
  }

  const currentIndex = sources.findIndex((source) => source.id === currentId);
  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

  for (let offset = 0; offset < sources.length; offset += 1) {
    const index = (startIndex + offset) % sources.length;
    const source = sources[index];

    if (source.id !== currentId && source.status === "review_pending") {
      return source.id;
    }
  }

  return undefined;
}

export function normalizeSourceDocumentFilters(
  filters: SourceDocumentFilters = {},
): NormalizedSourceDocumentFilters {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const productId =
    filters.productId && filters.productId !== "all"
      ? filters.productId
      : undefined;
  const status =
    filters.status && filters.status !== "all" ? filters.status : undefined;
  const sourceType =
    filters.sourceType && filters.sourceType !== "all"
      ? filters.sourceType
      : undefined;
  const search = filters.search?.trim() || undefined;

  return {
    page,
    pageSize,
    from,
    to,
    productId,
    status,
    sourceType,
    search,
  };
}

function escapePostgrestLike(value: string) {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export async function fetchSourceDocuments(
  filters: SourceDocumentFilters = {},
) {
  const normalized = normalizeSourceDocumentFilters(filters);
  let query = supabase
    .from("source_documents")
    .select("*, products(id, sku, name_ko)", { count: "exact" });

  if (normalized.productId) {
    query = query.eq("product_id", normalized.productId);
  }

  if (normalized.status) {
    query = query.eq("status", normalized.status);
  }

  if (normalized.sourceType) {
    query = query.eq("source_type", normalized.sourceType);
  }

  if (normalized.search) {
    const pattern = `%${escapePostgrestLike(normalized.search)}%`;
    query = query.or(
      `title.ilike.${pattern},raw_text.ilike.${pattern},markdown.ilike.${pattern},source_url.ilike.${pattern}`,
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(normalized.from, normalized.to);

  if (error) {
    throw error;
  }

  return {
    data: (data ?? []) as unknown as SourceDocumentWithProduct[],
    count: count ?? 0,
    page: normalized.page,
    pageSize: normalized.pageSize,
  };
}

export async function fetchSourceDocument(id: string) {
  const { data, error } = await supabase
    .from("source_documents")
    .select("*, products(id, sku, name_ko)")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as SourceDocumentWithProduct;
}

async function getReviewerId() {
  const { data, error } = await supabase.auth.getUser();

  return resolveUserIdOrDemo(data.user, error);
}

async function reviewSourceDocument(
  id: string,
  action: ReviewAction,
  note?: string,
  extraUpdate: Partial<SourceDocumentInsert> = {},
) {
  const reviewerId = await getReviewerId();
  const { data: current, error: currentError } = await supabase
    .from("source_documents")
    .select("status")
    .eq("id", id)
    .single();

  if (currentError) {
    throw currentError;
  }

  const isApproval = action === "approved" || action === "approved_with_edit";
  const updatePayload: Record<string, unknown> = {
    ...extraUpdate,
    status: action,
    reviewer_id: reviewerId,
    review_note: note?.trim() || null,
    approved_at: isApproval ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("source_documents")
    .update(updatePayload)
    .eq("id", id)
    .select("*, products(id, sku, name_ko)")
    .single();

  if (error) {
    throw error;
  }

  const { error: reviewEventError } = await supabase
    .from("review_events")
    .insert({
      target_type: "source_document",
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

  return data as unknown as SourceDocumentWithProduct;
}

export function approveSource(id: string, note?: string) {
  return reviewSourceDocument(id, "approved", note);
}

export function approveSourceWithEdit(
  id: string,
  markdown: string,
  note?: string,
) {
  return reviewSourceDocument(id, "approved_with_edit", note, { markdown });
}

export function rejectSource(id: string, note: string) {
  return reviewSourceDocument(id, "rejected", note);
}

export function markSourceDuplicate(id: string, note?: string) {
  return reviewSourceDocument(id, "duplicate", note);
}

export async function addManualSource(input: ManualSourceInput) {
  const rawText = input.rawText.trim();

  if (!rawText) {
    throw new Error("원문 내용이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("source_documents")
    .insert({
      product_id: input.productId,
      source_type: "manual",
      source_url: input.sourceUrl?.trim() || null,
      title: input.title.trim() || "수동 입력 원문",
      raw_text: rawText,
      markdown: input.markdown?.trim() || rawText,
      reliability_score: input.reliabilityScore ?? 0.7,
      status: "review_pending",
      collected_at: new Date().toISOString(),
    })
    .select("*, products(id, sku, name_ko)")
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as SourceDocumentWithProduct;
}

export async function createCollectionJob(params: CreateCollectionJobParams) {
  if (params.sourceTypes.length === 0) {
    throw new Error("수집할 출처 유형을 선택해야 합니다.");
  }

  const { data, error } = await supabase.functions.invoke("search-sources", {
    body: params,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function crawlSourceDocument(id: string) {
  const { data, error } = await supabase.functions.invoke("crawl-source", {
    body: { source_document_id: id },
  });

  if (error) {
    throw await toFunctionInvokeError(error);
  }

  const payload = data as { ok?: boolean; error?: string } | null;

  if (payload?.ok === false) {
    throw new Error(payload.error ?? "Source crawl failed");
  }

  return data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getPayloadErrorMessage(payload: unknown) {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return undefined;
}

async function toFunctionInvokeError(error: unknown) {
  const context = isRecord(error) ? error.context : undefined;

  if (context instanceof Response) {
    try {
      const message = getPayloadErrorMessage(await context.clone().json());

      if (message) {
        return new Error(message);
      }
    } catch {
      // Fall through to text or original error.
    }

    try {
      const text = await context.clone().text();

      if (text.trim()) {
        return new Error(text.trim());
      }
    } catch {
      // Fall through to original error.
    }
  }

  return error instanceof Error ? error : new Error(String(error));
}
