import {
  clamp,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readJson,
  requireEnv,
} from "../_shared/http.ts";
import {
  extractGeminiInteractionText,
  type GeminiInteractionResponse,
} from "../_shared/gemini-interactions.ts";

type ExtractMetadataRequest = {
  source_document_id?: string;
  sourceDocumentId?: string;
};

type ExtractedMetadata = {
  summary: string;
  cultural_keywords: string[];
  materials: string[];
  eras: string[];
  techniques: string[];
  warnings: string[];
  reliability_score: number;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();
  let sourceDocumentId: string | undefined;

  try {
    const body = await readJson<ExtractMetadataRequest>(request);
    sourceDocumentId = body.source_document_id ?? body.sourceDocumentId;

    if (!sourceDocumentId) {
      throw new Error("source_document_id is required");
    }

    const { data: source, error: sourceError } = await supabase
      .from("source_documents")
      .select("*, products(id, sku, name_ko, materials, cultural_keywords)")
      .eq("id", sourceDocumentId)
      .single();

    if (sourceError) {
      throw sourceError;
    }

    const text = source.markdown || source.raw_text;

    if (!text?.trim()) {
      throw new Error("source text is empty");
    }

    const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash";
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": requireEnv("GEMINI_API_KEY"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          system_instruction:
            "You extract structured metadata from Korean source material for a factual RAG workflow. Return JSON only. Do not infer facts that are not present in the source.",
          input: buildPrompt(source, text),
          generation_config: {
            temperature: 0.1,
            thinking_level: "low",
          },
        }),
      },
    );

    const geminiPayload =
      (await geminiResponse.json()) as GeminiInteractionResponse;

    if (!geminiResponse.ok) {
      throw new Error(
        `Gemini API ${geminiResponse.status}: ${JSON.stringify(
          geminiPayload,
        )}`,
      );
    }

    const outputText = extractGeminiInteractionText(geminiPayload);

    if (!outputText) {
      throw new Error("Gemini response did not include output text");
    }

    const extracted = normalizeMetadata(parseJsonObject(outputText));
    const existingMetadata =
      source.extracted_metadata &&
      typeof source.extracted_metadata === "object" &&
      !Array.isArray(source.extracted_metadata)
        ? source.extracted_metadata
        : {};

    const { error: updateError } = await supabase
      .from("source_documents")
      .update({
        extracted_metadata: {
          ...existingMetadata,
          ...extracted,
          gemini: {
            model,
            interaction_id: geminiPayload.id ?? null,
          },
        },
        reliability_score: extracted.reliability_score,
        review_note: null,
        status: "review_pending",
      })
      .eq("id", sourceDocumentId);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({
      ok: true,
      data: { source_document_id: sourceDocumentId, metadata: extracted },
    });
  } catch (error) {
    if (sourceDocumentId) {
      await supabase
        .from("source_documents")
        .update({
          status: "parse_failed",
          review_note: error instanceof Error ? error.message : String(error),
        })
        .eq("id", sourceDocumentId);
    }

    return errorResponse(error);
  }
});

function buildPrompt(source: Record<string, unknown>, text: string) {
  const product = source.products as
    | {
        sku?: string;
        name_ko?: string;
        materials?: string[];
        cultural_keywords?: string[];
      }
    | undefined;
  const excerpt = text.slice(0, 14_000);

  return `Product:
- SKU: ${product?.sku ?? ""}
- Korean name: ${product?.name_ko ?? ""}
- Existing materials: ${(product?.materials ?? []).join(", ")}
- Existing cultural keywords: ${(product?.cultural_keywords ?? []).join(", ")}

Source title: ${source.title ?? ""}
Source type: ${source.source_type ?? ""}
Source URL: ${source.source_url ?? ""}

Extract this JSON schema only:
{
  "summary": "1-2 Korean sentences grounded only in the source",
  "cultural_keywords": ["keyword"],
  "materials": ["material"],
  "eras": ["era or dynasty if explicitly present"],
  "techniques": ["craft technique if explicitly present"],
  "warnings": ["uncertain or promotional claim to avoid"],
  "reliability_score": 0.0
}

Source:
${excerpt}`;
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const match = withoutFence.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error("Gemini response was not JSON");
  }

  return JSON.parse(match[0]) as Record<string, unknown>;
}

function normalizeMetadata(value: Record<string, unknown>): ExtractedMetadata {
  return {
    summary: typeof value.summary === "string" ? value.summary : "",
    cultural_keywords: toStringArray(value.cultural_keywords),
    materials: toStringArray(value.materials),
    eras: toStringArray(value.eras),
    techniques: toStringArray(value.techniques),
    warnings: toStringArray(value.warnings),
    reliability_score: clamp(Number(value.reliability_score ?? 0.5), 0, 1),
  };
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return typeof value === "string" && value.trim() ? [value.trim()] : [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}
