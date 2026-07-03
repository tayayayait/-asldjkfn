import { supabase } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/database.types";

export type StoryChunk = Database["public"]["Tables"]["story_chunks"]["Row"];
export type StoryEmbedding =
  Database["public"]["Tables"]["story_embeddings"]["Row"];
export type EmbeddingStatus = StoryEmbedding["status"];
export type SourceDocument =
  Database["public"]["Tables"]["source_documents"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];

export type KnowledgeChunk = StoryChunk & {
  embedding: StoryEmbedding | null;
  source: Pick<SourceDocument, "id" | "title" | "source_url" | "source_type"> | null;
  product: Pick<Product, "id" | "sku" | "name_ko"> | null;
};

export type KnowledgeFilters = {
  productId?: string | "all";
  status?: EmbeddingStatus | "all";
  search?: string;
  page?: number;
  pageSize?: number;
};

export type NormalizedKnowledgeFilters = Required<
  Pick<KnowledgeFilters, "page" | "pageSize">
> & {
  from: number;
  to: number;
  productId?: string;
  status?: EmbeddingStatus;
  search?: string;
};

export type ChunkTextOptions = {
  maxChars?: number;
  overlapChars?: number;
};

export type EmbedProductStoryParams = {
  productId: string;
  sourceDocumentIds?: string[];
  force?: boolean;
};

export type SimilaritySearchParams = {
  query: string;
  productId?: string | "all";
  topK?: number;
  threshold?: number;
};

export type SimilaritySearchResult = {
  id: string;
  chunk_id: string;
  product_id: string;
  content: string;
  similarity: number;
  source_document_id?: string | null;
  source_title?: string | null;
  source_url?: string | null;
  product_name?: string | null;
};

export type KnowledgeStats = {
  approvedSources: number;
  chunks: number;
  embedded: number;
  failed: number;
  queued: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_CHUNK_MAX_CHARS = 1_200;
const DEFAULT_CHUNK_OVERLAP_CHARS = 160;
export const LOW_SIMILARITY_THRESHOLD = 0.55;

export const EMBEDDING_STATUS_LABELS: Record<EmbeddingStatus, string> = {
  not_required: "불필요",
  pending: "대기",
  queued: "큐 등록",
  embedding: "임베딩 중",
  embedded: "완료",
  stale: "갱신 필요",
  failed: "실패",
};

export function estimateTokenCount(text: string) {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  return Math.ceil(normalized.length / 3);
}

export function chunkTextForEmbedding(
  text: string,
  options: ChunkTextOptions = {},
) {
  const maxChars = Math.max(40, options.maxChars ?? DEFAULT_CHUNK_MAX_CHARS);
  const overlapChars = Math.max(
    0,
    Math.min(options.overlapChars ?? DEFAULT_CHUNK_OVERLAP_CHARS, maxChars - 1),
  );
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/).filter(Boolean);
  const rawChunks: string[] = [];
  let current = "";

  const withPreviousOverlap = (next: string) => {
    const previous = rawChunks.at(-1);

    if (!previous || overlapChars === 0) {
      return next;
    }

    const separatorLength = 2;
    const maxTailLength = Math.max(0, maxChars - next.length - separatorLength);
    const tailLength = Math.min(
      overlapChars,
      maxTailLength,
    );

    if (tailLength === 0) {
      return next;
    }

    let start = previous.length - tailLength;

    while (
      start > 0 &&
      !/\s/.test(previous[start - 1]) &&
      previous.length - (start - 1) <= maxTailLength
    ) {
      start -= 1;
    }

    return `${previous.slice(start)}\n\n${next}`;
  };

  const flushCurrent = () => {
    if (current.trim()) {
      rawChunks.push(current.trim());
      current = "";
    }
  };

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    if (trimmed.length > maxChars) {
      flushCurrent();
      for (let start = 0; start < trimmed.length; start += maxChars - overlapChars) {
        rawChunks.push(trimmed.slice(start, start + maxChars).trim());
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${trimmed}` : trimmed;

    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      flushCurrent();
      current = withPreviousOverlap(trimmed);
    }
  }

  flushCurrent();

  return rawChunks.map((content, index) => ({
    chunkIndex: index,
    content,
    charLength: content.length,
    tokenCount: estimateTokenCount(content),
  }));
}

export function formatEmbeddingForRpc(values: number[]) {
  if (values.length === 0) {
    throw new Error("Embedding vector is empty");
  }

  return `[${values
    .map((value) => {
      if (!Number.isFinite(value)) {
        throw new Error("Embedding contains a non-finite value");
      }

      return Number(value).toString();
    })
    .join(",")}]`;
}

export function isLowSimilarity(
  similarity: number,
  threshold = LOW_SIMILARITY_THRESHOLD,
) {
  return similarity < threshold;
}

export function normalizeKnowledgeFilters(
  filters: KnowledgeFilters = {},
): NormalizedKnowledgeFilters {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE),
  );

  return {
    page,
    pageSize,
    from: (page - 1) * pageSize,
    to: page * pageSize - 1,
    productId:
      filters.productId && filters.productId !== "all"
        ? filters.productId
        : undefined,
    status:
      filters.status && filters.status !== "all" ? filters.status : undefined,
    search: filters.search?.trim() || undefined,
  };
}

function escapePostgrestLike(value: string) {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export async function fetchKnowledgeChunks(filters: KnowledgeFilters = {}) {
  const normalized = normalizeKnowledgeFilters(filters);
  let chunkIdsByStatus: string[] | undefined;

  if (normalized.status) {
    const { data, error } = await supabase
      .from("story_embeddings")
      .select("chunk_id")
      .eq("status", normalized.status)
      .limit(1_000);

    if (error) {
      throw error;
    }

    chunkIdsByStatus = (data ?? []).map((item) => item.chunk_id);

    if (chunkIdsByStatus.length === 0) {
      return { data: [] as KnowledgeChunk[], count: 0, page: normalized.page, pageSize: normalized.pageSize };
    }
  }

  let query = supabase
    .from("story_chunks")
    .select("*", { count: "exact" });

  if (normalized.productId) {
    query = query.eq("product_id", normalized.productId);
  }

  if (normalized.search) {
    query = query.ilike("content", `%${escapePostgrestLike(normalized.search)}%`);
  }

  if (chunkIdsByStatus) {
    query = query.in("id", chunkIdsByStatus);
  }

  const { data: chunks, error, count } = await query
    .order("created_at", { ascending: false })
    .range(normalized.from, normalized.to);

  if (error) {
    throw error;
  }

  const rows = (chunks ?? []) as StoryChunk[];

  if (rows.length === 0) {
    return { data: [] as KnowledgeChunk[], count: count ?? 0, page: normalized.page, pageSize: normalized.pageSize };
  }

  const chunkIds = rows.map((chunk) => chunk.id);
  const sourceIds = Array.from(new Set(rows.map((chunk) => chunk.source_document_id)));
  const productIds = Array.from(new Set(rows.map((chunk) => chunk.product_id)));

  const [embeddingsResult, sourcesResult, productsResult] = await Promise.all([
    supabase
      .from("story_embeddings")
      .select("*")
      .in("chunk_id", chunkIds),
    supabase
      .from("source_documents")
      .select("id, title, source_url, source_type")
      .in("id", sourceIds),
    supabase
      .from("products")
      .select("id, sku, name_ko")
      .in("id", productIds),
  ]);

  const joinError =
    embeddingsResult.error ?? sourcesResult.error ?? productsResult.error;

  if (joinError) {
    throw joinError;
  }

  const embeddingsByChunk = new Map(
    (embeddingsResult.data ?? []).map((embedding) => [
      embedding.chunk_id,
      embedding as StoryEmbedding,
    ]),
  );
  const sourcesById = new Map(
    (sourcesResult.data ?? []).map((source) => [
      source.id,
      source as KnowledgeChunk["source"],
    ]),
  );
  const productsById = new Map(
    (productsResult.data ?? []).map((product) => [
      product.id,
      product as KnowledgeChunk["product"],
    ]),
  );

  return {
    data: rows.map((chunk) => ({
      ...chunk,
      embedding: embeddingsByChunk.get(chunk.id) ?? null,
      source: sourcesById.get(chunk.source_document_id) ?? null,
      product: productsById.get(chunk.product_id) ?? null,
    })),
    count: count ?? 0,
    page: normalized.page,
    pageSize: normalized.pageSize,
  };
}

export async function fetchKnowledgeStats(productId?: string | "all") {
  const productFilter =
    productId && productId !== "all" ? { product_id: productId } : undefined;
  const applyProductFilter = <T>(
    query: T,
  ): T =>
    productFilter
      ? (query as { eq: (column: string, value: string) => T }).eq(
          "product_id",
          productFilter.product_id,
        )
      : query;

  const [
    approvedSources,
    chunks,
    embedded,
    failed,
    queued,
  ] = await Promise.all([
    applyProductFilter(
      supabase
        .from("source_documents")
        .select("*", { count: "exact", head: true })
        .in("status", ["approved", "approved_with_edit"]),
    ),
    applyProductFilter(
      supabase
        .from("story_chunks")
        .select("*", { count: "exact", head: true }),
    ),
    applyProductFilter(
      supabase
        .from("story_embeddings")
        .select("*", { count: "exact", head: true })
        .eq("status", "embedded"),
    ),
    applyProductFilter(
      supabase
        .from("story_embeddings")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed"),
    ),
    applyProductFilter(
      supabase
        .from("story_embeddings")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "queued", "embedding", "stale"]),
    ),
  ]);

  const error =
    approvedSources.error ??
    chunks.error ??
    embedded.error ??
    failed.error ??
    queued.error;

  if (error) {
    throw error;
  }

  return {
    approvedSources: approvedSources.count ?? 0,
    chunks: chunks.count ?? 0,
    embedded: embedded.count ?? 0,
    failed: failed.count ?? 0,
    queued: queued.count ?? 0,
  } satisfies KnowledgeStats;
}

export async function embedProductStory(params: EmbedProductStoryParams) {
  const { data, error } = await supabase.functions.invoke(
    "embed-product-story",
    {
      body: {
        product_id: params.productId,
        source_document_ids: params.sourceDocumentIds,
        force: params.force ?? true,
      },
    },
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function searchSimilarChunks(params: SimilaritySearchParams) {
  const query = params.query.trim();

  if (!query) {
    return [] as SimilaritySearchResult[];
  }

  const { data, error } = await supabase.functions.invoke("search-knowledge", {
    body: {
      query,
      product_id:
        params.productId && params.productId !== "all"
          ? params.productId
          : undefined,
      top_k: params.topK ?? 5,
      threshold: params.threshold ?? 0.5,
    },
  });

  if (error) {
    throw error;
  }

  const payload = data as
    | { ok?: boolean; data?: { results?: SimilaritySearchResult[] }; error?: string }
    | SimilaritySearchResult[];

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload.ok === false) {
    throw new Error(payload.error ?? "검색에 실패했습니다.");
  }

  return payload.data?.results ?? [];
}

export function metadataValue(metadata: Json, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }

  return (metadata as Record<string, Json>)[key];
}
