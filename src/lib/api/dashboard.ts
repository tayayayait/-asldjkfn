import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type SourceDocument = Database["public"]["Tables"]["source_documents"]["Row"];
type ContentGeneration =
  Database["public"]["Tables"]["content_generations"]["Row"];
type ImageGeneration = Database["public"]["Tables"]["image_generations"]["Row"];
type Job = Database["public"]["Tables"]["jobs"]["Row"];
type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export type PendingReviewItem = {
  id: string;
  product_id?: string | null;
  product_name?: string | null;
  title?: string | null;
  status: string;
  created_at: string;
};

export type DashboardData = {
  kpis: {
    totalProducts: number;
    knowledgeReady: number;
    sourceReviewPending: number;
    contentReviewPending: number;
    imageReviewPending: number;
    failedJobs: number;
  };
  productStatusCounts: Record<Product["status"], number>;
  pending: {
    sources: PendingReviewItem[];
    contents: PendingReviewItem[];
    images: PendingReviewItem[];
  };
  failedJobs: Job[];
  activity: AuditLog[];
};

export async function fetchDashboardData(): Promise<DashboardData> {
  const [
    productsResult,
    contentPendingResult,
    imagePendingResult,
    failedJobsResult,
    sourcePendingResult,
    auditResult,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, status", { count: "exact" })
      .neq("status", "archived"),
    supabase
      .from("content_generations")
      .select("id, product_id, status, created_at, products(id, name_ko)", {
        count: "exact",
      })
      .eq("status", "review_pending")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("image_generations")
      .select("id, product_id, status, created_at, products(id, name_ko)", {
        count: "exact",
      })
      .eq("status", "review_pending")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("jobs")
      .select("*", { count: "exact" })
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("source_documents")
      .select("id, product_id, title, status, created_at, products(id, name_ko)", {
        count: "exact",
      })
      .eq("status", "review_pending")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const error =
    productsResult.error ??
    contentPendingResult.error ??
    imagePendingResult.error ??
    failedJobsResult.error ??
    sourcePendingResult.error ??
    auditResult.error;

  if (error) {
    throw error;
  }

  const products = (productsResult.data ?? []) as Pick<Product, "id" | "status">[];
  const productStatusCounts = emptyProductStatusCounts();

  for (const product of products) {
    productStatusCounts[product.status] += 1;
  }

  return {
    kpis: {
      totalProducts: productsResult.count ?? products.length,
      knowledgeReady: products.filter((product) =>
        ["knowledge_ready", "content_ready", "image_ready", "completed"].includes(
          product.status,
        ),
      ).length,
      sourceReviewPending: sourcePendingResult.count ?? 0,
      contentReviewPending: contentPendingResult.count ?? 0,
      imageReviewPending: imagePendingResult.count ?? 0,
      failedJobs: failedJobsResult.count ?? 0,
    },
    productStatusCounts,
    pending: {
      sources: mapPendingSources(sourcePendingResult.data ?? []),
      contents: mapPendingRelations(contentPendingResult.data ?? []),
      images: mapPendingRelations(imagePendingResult.data ?? []),
    },
    failedJobs: (failedJobsResult.data ?? []) as Job[],
    activity: (auditResult.data ?? []) as AuditLog[],
  };
}

function emptyProductStatusCounts(): Record<Product["status"], number> {
  return {
    draft: 0,
    collecting: 0,
    review_required: 0,
    knowledge_ready: 0,
    content_ready: 0,
    image_ready: 0,
    completed: 0,
    archived: 0,
  };
}

function mapPendingSources(rows: unknown[]) {
  return rows.map((row) => {
    const source = row as SourceDocument & {
      products?: { name_ko?: string | null } | null;
    };

    return {
      id: source.id,
      product_id: source.product_id,
      product_name: source.products?.name_ko ?? null,
      title: source.title,
      status: source.status,
      created_at: source.created_at,
    };
  });
}

function mapPendingRelations(rows: unknown[]) {
  return rows.map((row) => {
    const item = row as (ContentGeneration | ImageGeneration) & {
      products?: { name_ko?: string | null } | null;
    };

    return {
      id: item.id,
      product_id: item.product_id,
      product_name: item.products?.name_ko ?? null,
      status: item.status,
      created_at: item.created_at,
    };
  });
}
