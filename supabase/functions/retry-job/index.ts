import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readJson,
} from "../_shared/http.ts";

type RetryJobRequest = {
  job_id?: string;
  jobId?: string;
};

type JobRecord = {
  id: string;
  job_type: "crawl" | "embed" | "generate_text" | "generate_image" | "export";
  target_type: string | null;
  target_id: string | null;
  status: "queued" | "running" | "retrying" | "completed" | "failed" | "canceled";
  attempt: number | null;
  max_attempts: number | null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await readJson<RetryJobRequest>(request);
    const jobId = body.job_id ?? body.jobId;

    if (!jobId) {
      throw new Error("job_id is required");
    }

    const supabase = createServiceClient();
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, job_type, target_type, target_id, status, attempt, max_attempts")
      .eq("id", jobId)
      .single();

    if (jobError) {
      throw jobError;
    }

    const record = job as JobRecord;

    if (record.status !== "failed") {
      throw new Error("Only failed jobs can be retried");
    }

    const attempt = record.attempt ?? 0;
    const maxAttempts = record.max_attempts ?? 3;

    if (attempt >= maxAttempts) {
      throw new Error("Job has reached max_attempts");
    }

    const { data: updated, error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "queued",
        progress: 0,
        attempt: attempt + 1,
        last_error: null,
        next_retry_at: null,
        started_at: null,
        completed_at: null,
      })
      .eq("id", record.id)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    await invokeRetryableFunction(supabase, record);

    return jsonResponse({
      ok: true,
      data: updated,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

async function invokeRetryableFunction(
  supabase: ReturnType<typeof createServiceClient>,
  job: JobRecord,
) {
  if (!job.target_id) {
    return;
  }

  if (job.job_type === "embed" && job.target_type === "product") {
    await supabase.functions.invoke("embed-product-story", {
      body: { product_id: job.target_id, force: true },
    });
    return;
  }

  if (job.job_type === "crawl" && job.target_type === "source_document") {
    await supabase.functions.invoke("crawl-source", {
      body: { source_document_id: job.target_id },
    });
  }
}
