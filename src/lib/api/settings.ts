import { supabase } from "@/lib/supabase/client";

export type ApiHealthStatus = "connected" | "not_configured" | "error";

export type ApiHealthCheck = {
  name: string;
  status: ApiHealthStatus;
  detail: string;
};

export async function fetchSystemHealth() {
  const [profileResult, bucketsResult] = await Promise.allSettled([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.storage.listBuckets(),
  ]);

  const supabaseOk =
    profileResult.status === "fulfilled" && !profileResult.value.error;
  const storageOk =
    bucketsResult.status === "fulfilled" && !bucketsResult.value.error;
  const buckets =
    bucketsResult.status === "fulfilled" && !bucketsResult.value.error
      ? bucketsResult.value.data ?? []
      : [];

  return {
    checks: [
      {
        name: "Supabase Database",
        status: supabaseOk ? "connected" : "error",
        detail: supabaseOk ? "profiles count query succeeded" : "query failed",
      },
      {
        name: "Supabase Storage",
        status: storageOk ? "connected" : "error",
        detail: storageOk ? `${buckets.length} buckets visible` : "bucket list failed",
      },
      {
        name: "Gemini API",
        status: "not_configured",
        detail: "Edge Function server secret required",
      },
      {
        name: "Naver Search API",
        status: "not_configured",
        detail: "Edge Function server secret required",
      },
      {
        name: "Firecrawl",
        status: "not_configured",
        detail: "Edge Function server secret required",
      },
    ] satisfies ApiHealthCheck[],
    buckets,
  };
}
