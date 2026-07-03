import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readJson,
} from "../_shared/http.ts";
import { generateGeminiEmbedding, getEmbeddingModel } from "../_shared/gemini-embeddings.ts";
import { chunkTextForEmbedding } from "../_shared/rag.ts";

type EmbedProductStoryRequest = {
  product_id?: string;
  productId?: string;
  source_document_ids?: string[];
  sourceDocumentIds?: string[];
  force?: boolean;
};

type SourceDocumentRecord = {
  id: string;
  product_id: string;
  source_type: string;
  source_url: string | null;
  title: string | null;
  raw_text: string;
  markdown: string | null;
  status: string;
};

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
    const body = await readJson<EmbedProductStoryRequest>(request);
    productId = body.product_id ?? body.productId;
    const sourceDocumentIds =
      body.source_document_ids ?? body.sourceDocumentIds ?? [];
    const force = body.force ?? true;

    if (!productId) {
      throw new Error("product_id is required");
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, sku, name_ko")
      .eq("id", productId)
      .single();

    if (productError) {
      throw productError;
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        job_type: "embed",
        target_type: "product",
        target_id: productId,
        target_name: product.name_ko,
        status: "running",
        progress: 5,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError) {
      throw jobError;
    }

    jobId = job.id;

    let sourceQuery = supabase
      .from("source_documents")
      .select("id, product_id, source_type, source_url, title, raw_text, markdown, status")
      .eq("product_id", productId)
      .in("status", ["approved", "approved_with_edit"]);

    if (sourceDocumentIds.length > 0) {
      sourceQuery = sourceQuery.in("id", sourceDocumentIds);
    }

    const { data: sources, error: sourceError } = await sourceQuery;

    if (sourceError) {
      throw sourceError;
    }

    const approvedSources = (sources ?? []) as SourceDocumentRecord[];
    const stats = {
      product_id: productId,
      sources: approvedSources.length,
      chunks_created: 0,
      embeddings_created: 0,
      embeddings_failed: 0,
      model: getEmbeddingModel(),
    };

    if (approvedSources.length === 0) {
      await supabase
        .from("products")
        .update({ status: "review_required" })
        .eq("id", productId);
      await completeJob(supabase, jobId, "completed", 100, "No approved sources");

      return jsonResponse({ ok: true, data: stats });
    }

    for (let sourceIndex = 0; sourceIndex < approvedSources.length; sourceIndex += 1) {
      const source = approvedSources[sourceIndex];
      const sourceText = source.markdown || source.raw_text;
      const chunks = chunkTextForEmbedding(sourceText, {
        maxChars: 1_200,
        overlapChars: 160,
      });

      if (force) {
        const { error: deleteError } = await supabase
          .from("story_chunks")
          .delete()
          .eq("source_document_id", source.id);

        if (deleteError) {
          throw deleteError;
        }
      }

      for (const chunk of chunks) {
        const { data: insertedChunk, error: chunkError } = await supabase
          .from("story_chunks")
          .insert({
            product_id: productId,
            source_document_id: source.id,
            chunk_index: chunk.chunkIndex,
            content: chunk.content,
            char_length: chunk.charLength,
            token_count: chunk.tokenCount,
            metadata: {
              source_title: source.title,
              source_type: source.source_type,
              source_url: source.source_url,
            },
          })
          .select("id")
          .single();

        if (chunkError) {
          throw chunkError;
        }

        stats.chunks_created += 1;

        const { data: embeddingRow, error: embeddingInsertError } = await supabase
          .from("story_embeddings")
          .insert({
            chunk_id: insertedChunk.id,
            product_id: productId,
            model: getEmbeddingModel(),
            status: "embedding",
          })
          .select("id")
          .single();

        if (embeddingInsertError) {
          throw embeddingInsertError;
        }

        try {
          const embedding = await generateGeminiEmbedding(chunk.content, "document");
          const { error: embeddingUpdateError } = await supabase
            .from("story_embeddings")
            .update({
              embedding: embedding.vector,
              model: embedding.model,
              status: "embedded",
            })
            .eq("id", embeddingRow.id);

          if (embeddingUpdateError) {
            throw embeddingUpdateError;
          }

          stats.embeddings_created += 1;
        } catch (error) {
          stats.embeddings_failed += 1;
          await supabase
            .from("story_embeddings")
            .update({ status: "failed" })
            .eq("id", embeddingRow.id);
        }
      }

      const progress = Math.round(((sourceIndex + 1) / approvedSources.length) * 90) + 5;
      await supabase
        .from("jobs")
        .update({ progress: Math.min(progress, 95) })
        .eq("id", jobId);
    }

    await supabase
      .from("products")
      .update({
        status:
          stats.embeddings_created > 0 && stats.embeddings_failed === 0
            ? "knowledge_ready"
            : "review_required",
      })
      .eq("id", productId);

    await completeJob(supabase, jobId, "completed", 100);

    return jsonResponse({ ok: true, data: stats });
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

    if (productId) {
      await supabase
        .from("products")
        .update({ status: "review_required" })
        .eq("id", productId);
    }

    return errorResponse(error);
  }
});

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
      progress,
      last_error: lastError ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}
