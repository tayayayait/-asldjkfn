import {
  clamp,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readJson,
} from "../_shared/http.ts";
import { generateGeminiEmbedding } from "../_shared/gemini-embeddings.ts";

type SearchKnowledgeRequest = {
  query?: string;
  product_id?: string;
  productId?: string;
  top_k?: number;
  topK?: number;
  threshold?: number;
};

type MatchEmbeddingRow = {
  id: string;
  chunk_id: string;
  product_id: string;
  content: string;
  similarity: number;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await readJson<SearchKnowledgeRequest>(request);
    const query = body.query?.trim();

    if (!query) {
      throw new Error("query is required");
    }

    const productId = body.product_id ?? body.productId ?? null;
    const topK = clamp(Number(body.top_k ?? body.topK ?? 5), 1, 20);
    const threshold = clamp(Number(body.threshold ?? 0.5), 0, 1);
    const supabase = createServiceClient();
    const embedding = await generateGeminiEmbedding(query, "query");
    const { data: matches, error: matchError } = await supabase.rpc(
      "match_embeddings",
      {
        query_embedding: embedding.vector,
        match_threshold: threshold,
        match_count: topK,
        filter_product_id: productId,
      },
    );

    if (matchError) {
      throw matchError;
    }

    const rows = (matches ?? []) as MatchEmbeddingRow[];

    if (rows.length === 0) {
      return jsonResponse({
        ok: true,
        data: { results: [], model: embedding.model },
      });
    }

    const chunkIds = rows.map((row) => row.chunk_id);
    const productIds = Array.from(new Set(rows.map((row) => row.product_id)));
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
    const [sourcesResult, productsResult] = await Promise.all([
      supabase
        .from("source_documents")
        .select("id, title, source_url, source_type")
        .in("id", sourceIds),
      supabase.from("products").select("id, sku, name_ko").in("id", productIds),
    ]);
    const joinError = sourcesResult.error ?? productsResult.error;

    if (joinError) {
      throw joinError;
    }

    const chunksById = new Map(
      (chunks ?? []).map((chunk) => [chunk.id, chunk.source_document_id]),
    );
    const sourcesById = new Map(
      (sourcesResult.data ?? []).map((source) => [source.id, source]),
    );
    const productsById = new Map(
      (productsResult.data ?? []).map((product) => [product.id, product]),
    );

    const results = rows.map((row) => {
      const sourceId = chunksById.get(row.chunk_id) ?? null;
      const source = sourceId ? sourcesById.get(sourceId) : null;
      const product = productsById.get(row.product_id);

      return {
        ...row,
        source_document_id: sourceId,
        source_title: source?.title ?? null,
        source_url: source?.source_url ?? null,
        source_type: source?.source_type ?? null,
        product_name: product?.name_ko ?? null,
      };
    });

    return jsonResponse({
      ok: true,
      data: {
        results,
        model: embedding.model,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
