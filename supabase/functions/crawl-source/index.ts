import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readJson,
  requireEnv,
} from "../_shared/http.ts";
import {
  assertUsableScrapedContent,
  getCrawlFailureHttpStatus,
  getCrawlFailureMessage,
} from "../_shared/crawl-errors.ts";

type CrawlSourceRequest = {
  source_document_id?: string;
  sourceDocumentId?: string;
  job_id?: string;
  jobId?: string;
};

type FirecrawlResponse = {
  success?: boolean;
  error?: string;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: Record<string, unknown> & {
      statusCode?: number | string;
      status_code?: number | string;
      error?: string;
    };
  };
  markdown?: string;
  metadata?: Record<string, unknown> & {
    statusCode?: number | string;
    status_code?: number | string;
    error?: string;
  };
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
  let jobId: string | undefined;

  try {
    const body = await readJson<CrawlSourceRequest>(request);
    sourceDocumentId = body.source_document_id ?? body.sourceDocumentId;
    jobId = body.job_id ?? body.jobId;

    if (!sourceDocumentId) {
      throw new Error("source_document_id is required");
    }

    await updateJob(supabase, jobId, {
      status: "running",
      progress: 10,
      started_at: new Date().toISOString(),
    });

    const { data: source, error: sourceError } = await supabase
      .from("source_documents")
      .select("*")
      .eq("id", sourceDocumentId)
      .single();

    if (sourceError) {
      throw sourceError;
    }

    if (!source.source_url) {
      throw new Error("source_url is empty");
    }

    await supabase
      .from("source_documents")
      .update({ status: "fetching" })
      .eq("id", sourceDocumentId);

    const firecrawlResponse = await fetch(
      "https://api.firecrawl.dev/v2/scrape",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${requireEnv("FIRECRAWL_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: source.source_url,
          formats: ["markdown"],
          onlyMainContent: true,
          timeout: 60_000,
          removeBase64Images: true,
          blockAds: true,
        }),
      },
    );

    const scraped = (await firecrawlResponse.json()) as FirecrawlResponse;

    if (!firecrawlResponse.ok || scraped.success === false) {
      throw new Error(
        scraped.error || `Firecrawl API ${firecrawlResponse.status}`,
      );
    }

    const markdown = scraped.data?.markdown ?? scraped.markdown ?? "";
    const scrapeMetadata = scraped.data?.metadata ?? scraped.metadata ?? {};
    assertUsableScrapedContent(markdown, scrapeMetadata);

    const existingMetadata =
      source.extracted_metadata &&
      typeof source.extracted_metadata === "object" &&
      !Array.isArray(source.extracted_metadata)
        ? source.extracted_metadata
        : {};

    const { error: updateError } = await supabase
      .from("source_documents")
      .update({
        raw_text: markdown || source.raw_text,
        markdown: markdown || source.markdown,
        title:
          typeof scrapeMetadata.title === "string"
            ? scrapeMetadata.title
            : source.title,
        extracted_metadata: {
          ...existingMetadata,
          firecrawl: scrapeMetadata,
        },
        status: "fetched",
        review_note: null,
        collected_at: new Date().toISOString(),
      })
      .eq("id", sourceDocumentId);

    if (updateError) {
      throw updateError;
    }

    await updateJob(supabase, jobId, {
      status: "completed",
      progress: 100,
      completed_at: new Date().toISOString(),
    });

    await invokeMetadataExtraction(sourceDocumentId);

    return jsonResponse({
      ok: true,
      data: { source_document_id: sourceDocumentId },
    });
  } catch (error) {
    const message = getCrawlFailureMessage(error);

    if (sourceDocumentId) {
      await supabase
        .from("source_documents")
        .update({
          status: "parse_failed",
          review_note: message,
        })
        .eq("id", sourceDocumentId);
    }

    await updateJob(supabase, jobId, {
      status: "failed",
      progress: 100,
      last_error: message,
      completed_at: new Date().toISOString(),
    });

    return errorResponse(error, getCrawlFailureHttpStatus(error));
  }
});

async function updateJob(
  supabase: ReturnType<typeof createServiceClient>,
  jobId: string | undefined,
  patch: Record<string, unknown>,
) {
  if (!jobId) {
    return;
  }

  await supabase.from("jobs").update(patch).eq("id", jobId);
}

async function invokeMetadataExtraction(sourceDocumentId: string) {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  await fetch(`${supabaseUrl}/functions/v1/extract-source-metadata`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source_document_id: sourceDocumentId }),
  });
}
