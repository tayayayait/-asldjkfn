import { supabase } from "@/lib/supabase/client";
import { resolveUserIdOrDemo } from "@/lib/auth/demo-user";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { Product } from "./products";
import type { PromptTemplate } from "./prompts";

export type ContentGeneration =
  Database["public"]["Tables"]["content_generations"]["Row"];
export type ContentGenerationInsert =
  Database["public"]["Tables"]["content_generations"]["Insert"];
export type ContentGenerationStatus = ContentGeneration["status"];
export type FactualityMode = ContentGeneration["factuality_mode"];

export type ContentProduct = Pick<Product, "id" | "sku" | "name_ko">;
export type ContentPromptTemplate = Pick<
  PromptTemplate,
  "id" | "purpose" | "language" | "channel" | "tone" | "version"
>;

export type ContentGenerationWithRelations = ContentGeneration & {
  products?: ContentProduct | null;
  prompt_templates?: ContentPromptTemplate | null;
};

export type ForbiddenTermMatch = {
  term: string;
  index: number;
};

export type RagContextChunk = {
  chunk_id?: string | null;
  id?: string | null;
  content: string;
  similarity?: number | null;
  source_title?: string | null;
  source_url?: string | null;
};

export type GenerateContentParams = {
  productId: string;
  purpose: string;
  language: string;
  tone: string;
  channel?: string;
  lengthRule?: string;
  factualityMode?: FactualityMode;
  forbiddenTerms?: string[];
  promptTemplateId?: string;
};

export type ContentGenerationFilters = {
  productId?: string | "all";
  status?: ContentGenerationStatus | "all";
  purpose?: string | "all";
  language?: string | "all";
  search?: string;
  page?: number;
  pageSize?: number;
};

export type NormalizedContentGenerationFilters = Required<
  Pick<ContentGenerationFilters, "page" | "pageSize">
> & {
  from: number;
  to: number;
  productId?: string;
  status?: ContentGenerationStatus;
  purpose?: string;
  language?: string;
  search?: string;
};

type ReviewAction = Extract<ContentGenerationStatus, "approved" | "rejected">;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const CONTENT_STATUS_LABELS: Record<ContentGenerationStatus, string> = {
  draft: "초안",
  generating: "생성 중",
  generated: "생성 완료",
  editing: "편집 중",
  review_pending: "검수 대기",
  approved: "승인",
  rejected: "반려",
  exported: "내보냄",
};

export const FACTUALITY_MODE_LABELS: Record<FactualityMode, string> = {
  strict: "엄격",
  normal: "보통",
  creative: "창의",
};

export function parseForbiddenTerms(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((term) => term.trim())
        .filter(Boolean),
    ),
  );
}

export function findForbiddenTerms(text: string, terms: string[]) {
  const normalizedText = text.toLocaleLowerCase();
  const matches: ForbiddenTermMatch[] = [];
  const seen = new Set<string>();

  for (const rawTerm of terms) {
    const term = rawTerm.trim();

    if (!term) {
      continue;
    }

    const key = term.toLocaleLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    const index = normalizedText.indexOf(key);

    if (index >= 0) {
      matches.push({ term, index });
    }
  }

  return matches.sort((a, b) => a.index - b.index);
}

export function buildRagContextText(chunks: RagContextChunk[]) {
  return chunks
    .map((chunk, index) => {
      const similarity =
        typeof chunk.similarity === "number"
          ? chunk.similarity.toFixed(3)
          : "n/a";
      const source = chunk.source_title || chunk.source_url || "unknown";
      const chunkId = chunk.chunk_id ?? chunk.id ?? "unknown";
      const url = chunk.source_url ? ` url=${chunk.source_url}` : "";

      return `[${index + 1}] score=${similarity} source=${source} chunk=${chunkId}${url}\n${chunk.content}`;
    })
    .join("\n\n");
}

export function normalizeContentGenerationFilters(
  filters: ContentGenerationFilters = {},
): NormalizedContentGenerationFilters {
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
    purpose:
      filters.purpose && filters.purpose !== "all" ? filters.purpose : undefined,
    language:
      filters.language && filters.language !== "all"
        ? filters.language
        : undefined,
    search: filters.search?.trim() || undefined,
  };
}

function escapePostgrestLike(value: string) {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export async function fetchContentGenerations(
  filters: ContentGenerationFilters = {},
) {
  const normalized = normalizeContentGenerationFilters(filters);
  let query = supabase
    .from("content_generations")
    .select(
      "*, products(id, sku, name_ko), prompt_templates(id, purpose, language, channel, tone, version)",
      { count: "exact" },
    );

  if (normalized.productId) {
    query = query.eq("product_id", normalized.productId);
  }

  if (normalized.status) {
    query = query.eq("status", normalized.status);
  }

  if (normalized.purpose) {
    query = query.eq("purpose", normalized.purpose);
  }

  if (normalized.language) {
    query = query.eq("language", normalized.language);
  }

  if (normalized.search) {
    const pattern = `%${escapePostgrestLike(normalized.search)}%`;
    query = query.or(
      `generated_text.ilike.${pattern},edited_text.ilike.${pattern},prompt_used.ilike.${pattern}`,
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(normalized.from, normalized.to);

  if (error) {
    throw error;
  }

  return {
    data: (data ?? []) as unknown as ContentGenerationWithRelations[],
    count: count ?? 0,
    page: normalized.page,
    pageSize: normalized.pageSize,
  };
}

export async function fetchContentGeneration(id: string) {
  const { data, error } = await supabase
    .from("content_generations")
    .select(
      "*, products(id, sku, name_ko), prompt_templates(id, purpose, language, channel, tone, version)",
    )
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as ContentGenerationWithRelations;
}

export async function generateContent(
  params: GenerateContentParams,
): Promise<ContentGenerationWithRelations> {
  const { data, error } = await supabase.functions.invoke("generate-content", {
    body: {
      product_id: params.productId,
      purpose: params.purpose,
      language: params.language,
      tone: params.tone,
      channel: params.channel,
      length_rule: params.lengthRule,
      factuality_mode: params.factualityMode ?? "normal",
      forbidden_terms: params.forbiddenTerms ?? [],
      prompt_template_id: params.promptTemplateId,
    },
  });

  if (error) {
    throw error;
  }

  const payload = data as {
    ok?: boolean;
    data?: ContentGenerationWithRelations;
    error?: string;
  };

  if (payload && typeof payload === "object" && "ok" in payload) {
    if (payload.ok === false) {
      throw new Error(payload.error ?? "Content generation failed");
    }

    if (!payload.data) {
      throw new Error("Content generation response did not include data");
    }

    return payload.data;
  }

  if (!data || typeof data !== "object") {
    throw new Error(payload.error ?? "Content generation failed");
  }

  return data as ContentGenerationWithRelations;
}

export async function updateContentText(id: string, editedText: string) {
  const { data, error } = await supabase
    .from("content_generations")
    .update({
      edited_text: editedText,
      status: "editing",
    })
    .eq("id", id)
    .select(
      "*, products(id, sku, name_ko), prompt_templates(id, purpose, language, channel, tone, version)",
    )
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as ContentGenerationWithRelations;
}

export async function submitContentForReview(id: string) {
  const { data, error } = await supabase
    .from("content_generations")
    .update({ status: "review_pending" })
    .eq("id", id)
    .select(
      "*, products(id, sku, name_ko), prompt_templates(id, purpose, language, channel, tone, version)",
    )
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as ContentGenerationWithRelations;
}

async function getReviewerId() {
  const { data, error } = await supabase.auth.getUser();

  return resolveUserIdOrDemo(data.user, error);
}

async function reviewContent(
  id: string,
  action: ReviewAction,
  note?: string,
) {
  const reviewerId = await getReviewerId();
  const { data: current, error: currentError } = await supabase
    .from("content_generations")
    .select("status")
    .eq("id", id)
    .single();

  if (currentError) {
    throw currentError;
  }

  const { data, error } = await supabase
    .from("content_generations")
    .update({
      status: action,
      reviewer_id: reviewerId,
      review_note: note?.trim() || null,
      approved_at: action === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select(
      "*, products(id, sku, name_ko), prompt_templates(id, purpose, language, channel, tone, version)",
    )
    .single();

  if (error) {
    throw error;
  }

  const { error: reviewEventError } = await supabase
    .from("review_events")
    .insert({
      target_type: "content",
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

  return data as unknown as ContentGenerationWithRelations;
}

export function approveContent(id: string, note?: string) {
  return reviewContent(id, "approved", note);
}

export function rejectContent(id: string, note: string) {
  return reviewContent(id, "rejected", note);
}

export function getContentText(generation: Pick<ContentGeneration, "edited_text" | "generated_text">) {
  return generation.edited_text || generation.generated_text || "";
}

export function ragContextChunks(value: Json): RagContextChunk[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is RagContextChunk => {
    return Boolean(
      item &&
        typeof item === "object" &&
        "content" in item &&
        typeof item.content === "string",
    );
  });
}
