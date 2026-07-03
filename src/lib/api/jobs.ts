import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type JobStatus = Job["status"];
export type JobType = Job["job_type"];

export type JobFilters = {
  jobType?: JobType | "all";
  status?: JobStatus | "all";
  page?: number;
  pageSize?: number;
};

export type NormalizedJobFilters = Required<
  Pick<JobFilters, "page" | "pageSize">
> & {
  from: number;
  to: number;
  jobType?: JobType;
  status?: JobStatus;
};

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  crawl: "자료 수집",
  embed: "AI 자료 준비",
  generate_text: "문구 만들기",
  generate_image: "이미지 만들기",
  export: "내보내기",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: "대기",
  running: "실행 중",
  retrying: "재시도",
  completed: "완료",
  failed: "실패",
  canceled: "취소",
};

export function canRetryJob(
  job: Pick<Job, "status" | "attempt" | "max_attempts">,
) {
  return (
    job.status === "failed" &&
    (job.attempt ?? 0) < (job.max_attempts ?? 3)
  );
}

export function normalizeJobFilters(
  filters: JobFilters = {},
): NormalizedJobFilters {
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
    jobType:
      filters.jobType && filters.jobType !== "all" ? filters.jobType : undefined,
    status:
      filters.status && filters.status !== "all" ? filters.status : undefined,
  };
}

export async function fetchJobs(filters: JobFilters = {}) {
  const normalized = normalizeJobFilters(filters);
  let query = supabase.from("jobs").select("*", { count: "exact" });

  if (normalized.jobType) {
    query = query.eq("job_type", normalized.jobType);
  }

  if (normalized.status) {
    query = query.eq("status", normalized.status);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
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

export async function fetchJobStats() {
  const { data, error } = await supabase
    .from("jobs")
    .select("job_type, status")
    .order("created_at", { ascending: false })
    .limit(1_000);

  if (error) {
    throw error;
  }

  const stats = new Map<JobType, Record<JobStatus, number>>();

  for (const row of data ?? []) {
    const current =
      stats.get(row.job_type) ??
      ({
        queued: 0,
        running: 0,
        retrying: 0,
        completed: 0,
        failed: 0,
        canceled: 0,
      } satisfies Record<JobStatus, number>);
    current[row.status] += 1;
    stats.set(row.job_type, current);
  }

  return stats;
}

export async function retryJob(id: string) {
  const { data, error } = await supabase.functions.invoke("retry-job", {
    body: { job_id: id },
  });

  if (error) {
    throw error;
  }

  const payload = data as { ok?: boolean; data?: Job; error?: string };

  if (payload?.ok === false) {
    throw new Error(payload.error ?? "Job retry failed");
  }

  return payload?.data ?? (data as Job);
}

export async function cancelJob(id: string) {
  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "canceled", completed_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["queued", "running", "retrying"])
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
