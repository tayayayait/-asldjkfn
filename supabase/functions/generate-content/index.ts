import {
  clamp,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readJson,
  requireEnv,
} from "../_shared/http.ts";
import { generateGeminiEmbedding } from "../_shared/gemini-embeddings.ts";
import {
  extractGeminiInteractionText,
  type GeminiInteractionResponse,
} from "../_shared/gemini-interactions.ts";

type GenerateContentRequest = {
  product_id?: string;
  productId?: string;
  prompt_template_id?: string;
  promptTemplateId?: string;
  purpose?: string;
  language?: string;
  tone?: string;
  channel?: string;
  length_rule?: string;
  lengthRule?: string;
  factuality_mode?: "strict" | "normal" | "creative";
  factualityMode?: "strict" | "normal" | "creative";
  forbidden_terms?: string[];
  forbiddenTerms?: string[];
};

type ProductRecord = {
  id: string;
  sku: string;
  name_ko: string;
  name_en: string | null;
  name_ja: string | null;
  name_zh: string | null;
  category: string;
  materials: string[];
  cultural_keywords: string[];
  description: string | null;
};

type PromptTemplateRecord = {
  id: string;
  purpose: string;
  language: string;
  channel: string;
  tone: string;
  template_body: string;
  version: number;
};

type MatchEmbeddingRow = {
  id: string;
  chunk_id: string;
  product_id: string;
  content: string;
  similarity: number;
};

type RagContextRow = MatchEmbeddingRow & {
  source_document_id: string | null;
  source_title: string | null;
  source_url: string | null;
  source_type: string | null;
};

const DEFAULT_LENGTH_RULE = "600자 이내";
const DEFAULT_TOP_K = 8;
const DEFAULT_THRESHOLD = 0.5;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();
  let jobId: string | undefined;
  let productId: string | undefined;

  try {
    const body = await readJson<GenerateContentRequest>(request);
    productId = body.product_id ?? body.productId;
    const purpose = body.purpose?.trim() || "product_detail";
    const language = body.language?.trim() || "ko";
    const channel = body.channel?.trim() || "own_mall";
    const tone = body.tone?.trim() || "정중한";
    const lengthRule =
      body.length_rule?.trim() || body.lengthRule?.trim() || DEFAULT_LENGTH_RULE;
    const factualityMode =
      body.factuality_mode ?? body.factualityMode ?? "normal";
    const forbiddenTerms = body.forbidden_terms ?? body.forbiddenTerms ?? [];
    const promptTemplateId = body.prompt_template_id ?? body.promptTemplateId;

    if (!productId) {
      throw new Error("product_id is required");
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select(
        "id, sku, name_ko, name_en, name_ja, name_zh, category, materials, cultural_keywords, description",
      )
      .eq("id", productId)
      .single();

    if (productError) {
      throw productError;
    }

    const productRecord = product as ProductRecord;
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        job_type: "generate_text",
        target_type: "product",
        target_id: productId,
        target_name: productRecord.name_ko,
        status: "running",
        progress: 10,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError) {
      throw jobError;
    }

    jobId = job.id;

    const promptTemplate = await resolvePromptTemplate(supabase, {
      promptTemplateId,
      purpose,
      language,
      channel,
      tone,
    });
    const ragContext = await retrieveRagContext(supabase, productRecord);
    const prompt = renderTemplate(promptTemplate.template_body, {
      product_name: productNameForLanguage(productRecord, language),
      product_sku: productRecord.sku,
      product_category: productRecord.category,
      product_description: productRecord.description ?? "",
      keywords: productRecord.cultural_keywords.join(", "),
      materials: productRecord.materials.join(", "),
      rag_context: buildRagContextText(ragContext),
      language,
      tone,
      channel,
      length_rule: lengthRule,
      factuality_mode: factualityMode,
      forbidden_terms: forbiddenTerms.join(", "),
    });
    await supabase.from("jobs").update({ progress: 55 }).eq("id", jobId);

    const systemInstruction = systemInstructionForMode(factualityMode, {
      language,
      tone,
      lengthRule,
      forbiddenTerms,
    });
    const generatedText = await generateGeminiText({
      systemInstruction,
      prompt,
      factualityMode,
    });
    const forbiddenMatches = findForbiddenTerms(generatedText.text, forbiddenTerms);
    const status = forbiddenMatches.length > 0 ? "editing" : "generated";

    const { data: inserted, error: insertError } = await supabase
      .from("content_generations")
      .insert({
        product_id: productId,
        prompt_template_id: promptTemplate.id,
        purpose,
        language,
        tone,
        channel,
        length_rule: lengthRule,
        factuality_mode: factualityMode,
        forbidden_terms: forbiddenTerms,
        generated_text: generatedText.text,
        edited_text: null,
        rag_context: ragContext,
        prompt_used: prompt,
        model: generatedText.model,
        token_usage: generatedText.usage,
        status,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    await supabase
      .from("products")
      .update({ status: "content_ready" })
      .eq("id", productId)
      .in("status", ["knowledge_ready", "review_required"]);

    await completeJob(supabase, jobId, "completed", 100);

    return jsonResponse({
      ok: true,
      data: inserted,
      meta: {
        forbidden_matches: forbiddenMatches,
        rag_chunks: ragContext.length,
      },
    });
  } catch (error) {
    if (jobId) {
      await completeJob(
        supabase,
        jobId,
        "failed",
        100,
        error instanceof Error ? error.message : String(error),
      );
    }

    return errorResponse(error);
  }
});

async function resolvePromptTemplate(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    promptTemplateId?: string;
    purpose: string;
    language: string;
    channel: string;
    tone: string;
  },
) {
  if (params.promptTemplateId) {
    const { data, error } = await supabase
      .from("prompt_templates")
      .select("id, purpose, language, channel, tone, template_body, version")
      .eq("id", params.promptTemplateId)
      .single();

    if (error) {
      throw error;
    }

    return data as PromptTemplateRecord;
  }

  let query = supabase
    .from("prompt_templates")
    .select("id, purpose, language, channel, tone, template_body, version")
    .eq("purpose", params.purpose)
    .eq("language", params.language)
    .eq("channel", params.channel)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1);

  if (params.tone) {
    query = query.eq("tone", params.tone);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const template = data?.[0] as PromptTemplateRecord | undefined;

  if (!template) {
    throw new Error("No active prompt template matches the requested options");
  }

  return template;
}

async function retrieveRagContext(
  supabase: ReturnType<typeof createServiceClient>,
  product: ProductRecord,
) {
  const query = [
    product.name_ko,
    product.name_en,
    product.category,
    product.cultural_keywords.join(" "),
    product.description,
  ]
    .filter(Boolean)
    .join("\n");
  const embedding = await generateGeminiEmbedding(query, "query");
  const { data: matches, error: matchError } = await supabase.rpc(
    "match_embeddings",
    {
      query_embedding: embedding.vector,
      match_threshold: DEFAULT_THRESHOLD,
      match_count: DEFAULT_TOP_K,
      filter_product_id: product.id,
    },
  );

  if (matchError) {
    throw matchError;
  }

  const rows = (matches ?? []) as MatchEmbeddingRow[];

  if (rows.length === 0) {
    return [] as RagContextRow[];
  }

  const chunkIds = rows.map((row) => row.chunk_id);
  const { data: chunks, error: chunkError } = await supabase
    .from("story_chunks")
    .select("id, source_document_id")
    .in("id", chunkIds);

  if (chunkError) {
    throw chunkError;
  }

  const sourceIds = Array.from(
    new Set((chunks ?? []).map((chunk) => chunk.source_document_id)),
  );
  const { data: sources, error: sourceError } = await supabase
    .from("source_documents")
    .select("id, title, source_url, source_type")
    .in("id", sourceIds);

  if (sourceError) {
    throw sourceError;
  }

  const sourceIdByChunk = new Map(
    (chunks ?? []).map((chunk) => [chunk.id, chunk.source_document_id]),
  );
  const sourcesById = new Map((sources ?? []).map((source) => [source.id, source]));

  return rows.map((row) => {
    const sourceId = sourceIdByChunk.get(row.chunk_id) ?? null;
    const source = sourceId ? sourcesById.get(sourceId) : null;

    return {
      ...row,
      source_document_id: sourceId,
      source_title: source?.title ?? null,
      source_url: source?.source_url ?? null,
      source_type: source?.source_type ?? null,
    };
  });
}

function buildRagContextText(chunks: RagContextRow[]) {
  if (chunks.length === 0) {
    return "사용 가능한 RAG 근거가 없습니다. 제품 기본 정보만 사용하고 근거 없는 세부 사실은 쓰지 마세요.";
  }

  return chunks
    .map((chunk, index) => {
      const source = chunk.source_title || chunk.source_url || "unknown";

      return `[${index + 1}] score=${chunk.similarity.toFixed(3)} source=${source} chunk=${chunk.chunk_id}
${chunk.content}`;
    })
    .join("\n\n");
}

function renderTemplate(template: string, variables: Record<string, unknown>) {
  return template.replace(
    /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g,
    (_match, variable: string) => {
      const value = variables[variable];

      if (value === undefined || value === null || value === "") {
        throw new Error(`Missing prompt variable: ${variable}`);
      }

      if (Array.isArray(value)) {
        return value.join(", ");
      }

      if (typeof value === "object") {
        return JSON.stringify(value, null, 2);
      }

      return String(value);
    },
  );
}

function systemInstructionForMode(
  mode: "strict" | "normal" | "creative",
  options: {
    language: string;
    tone: string;
    lengthRule: string;
    forbiddenTerms: string[];
  },
) {
  const base = [
    "You write product content for Korean traditional culture souvenirs.",
    `Write in ${options.language} with a ${options.tone} tone.`,
    `Target length: ${options.lengthRule}.`,
    "Use only the supplied product information and RAG context for factual claims.",
    "Do not invent makers, dates, historical facts, awards, materials, or certifications.",
  ];

  if (mode === "strict") {
    base.push(
      "Strict mode: omit any claim that is not explicitly supported by the context.",
    );
  } else if (mode === "creative") {
    base.push(
      "Creative mode: you may vary sentence rhythm and imagery, but factual claims must still be supported.",
    );
  } else {
    base.push(
      "Normal mode: concise marketing style is allowed when factual statements remain grounded.",
    );
  }

  if (options.forbiddenTerms.length > 0) {
    base.push(`Avoid these terms exactly: ${options.forbiddenTerms.join(", ")}`);
  }

  return base.join("\n");
}

async function generateGeminiText(params: {
  systemInstruction: string;
  prompt: string;
  factualityMode: "strict" | "normal" | "creative";
}) {
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash";
  const temperature =
    params.factualityMode === "strict"
      ? 0.2
      : params.factualityMode === "creative"
        ? 0.75
        : 0.45;
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "x-goog-api-key": requireEnv("GEMINI_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        system_instruction: params.systemInstruction,
        input: params.prompt,
        generation_config: {
          temperature,
          max_output_tokens: 1_200,
          thinking_level: "low",
        },
        store: false,
      }),
    },
  );
  const payload = (await response.json()) as GeminiInteractionResponse;

  if (!response.ok) {
    throw new Error(`Gemini text API ${response.status}: ${JSON.stringify(payload)}`);
  }

  const text = extractGeminiInteractionText(payload) ?? "";

  if (!text) {
    throw new Error("Gemini text response did not include generated text");
  }

  return {
    text,
    model,
    usage: payload.usage_metadata ?? payload.usageMetadata ?? {},
  };
}

function findForbiddenTerms(text: string, terms: string[]) {
  const normalizedText = text.toLocaleLowerCase();

  return Array.from(new Set(terms.map((term) => term.trim()).filter(Boolean)))
    .map((term) => ({
      term,
      index: normalizedText.indexOf(term.toLocaleLowerCase()),
    }))
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index);
}

function productNameForLanguage(product: ProductRecord, language: string) {
  if (language === "en" && product.name_en) {
    return product.name_en;
  }

  if (language === "ja" && product.name_ja) {
    return product.name_ja;
  }

  if (language === "zh-CN" && product.name_zh) {
    return product.name_zh;
  }

  return product.name_ko;
}

async function completeJob(
  supabase: ReturnType<typeof createServiceClient>,
  jobId: string,
  status: "completed" | "failed",
  progress: number,
  lastError?: string,
) {
  await supabase
    .from("jobs")
    .update({
      status,
      progress: clamp(progress, 0, 100),
      last_error: lastError ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}
