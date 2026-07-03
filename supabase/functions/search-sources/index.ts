import {
  clamp,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  normalizeSourceUrl,
  readJson,
  requireEnv,
  stripSearchHighlightTags,
} from "../_shared/http.ts";

type CollectionSourceType =
  | "own_mall"
  | "naver_web"
  | "naver_blog"
  | "naver_news";

type SearchSourcesRequest = {
  productIds?: string[];
  sourceTypes?: CollectionSourceType[];
  limitPerSource?: number;
  query?: string;
};

type ProductRecord = {
  id: string;
  sku: string;
  name_ko: string;
  materials: string[] | null;
  cultural_keywords: string[] | null;
  own_mall_url: string | null;
  description: string | null;
};

type NaverSearchItem = {
  title?: string;
  link?: string;
  originallink?: string;
  description?: string;
  bloggername?: string;
  bloggerlink?: string;
  postdate?: string;
  pubDate?: string;
};

const allowedSourceTypes = new Set<CollectionSourceType>([
  "own_mall",
  "naver_web",
  "naver_blog",
  "naver_news",
]);

const naverConfig = {
  naver_web: {
    endpoint: "https://openapi.naver.com/v1/search/webkr.json",
    sort: undefined,
  },
  naver_blog: {
    endpoint: "https://openapi.naver.com/v1/search/blog.json",
    sort: "sim",
  },
  naver_news: {
    endpoint: "https://openapi.naver.com/v1/search/news.json",
    sort: "sim",
  },
} satisfies Record<
  Exclude<CollectionSourceType, "own_mall">,
  { endpoint: string; sort?: string }
>;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await readJson<SearchSourcesRequest>(request);
    const supabase = createServiceClient();
    const requestedTypes = body.sourceTypes?.filter((item) =>
      allowedSourceTypes.has(item),
    );
    const sourceTypes =
      requestedTypes && requestedTypes.length > 0
        ? requestedTypes
        : (["own_mall", "naver_web", "naver_blog", "naver_news"] as const);
    const limitPerSource = clamp(Number(body.limitPerSource ?? 10), 1, 100);
    const needsNaver = sourceTypes.some((item) => item.startsWith("naver_"));
    const naverClientId = needsNaver ? requireEnv("NAVER_CLIENT_ID") : "";
    const naverClientSecret = needsNaver
      ? requireEnv("NAVER_CLIENT_SECRET")
      : "";

    let productQuery = supabase
      .from("products")
      .select(
        "id, sku, name_ko, materials, cultural_keywords, own_mall_url, description",
      )
      .neq("status", "archived");

    if (body.productIds && body.productIds.length > 0) {
      productQuery = productQuery.in("id", body.productIds);
    }

    const { data: products, error: productError } = await productQuery;

    if (productError) {
      throw productError;
    }

    const stats = {
      products_scanned: products?.length ?? 0,
      urls_found: 0,
      urls_queued: 0,
      duplicates_skipped: 0,
      errors: [] as string[],
    };

    for (const product of (products ?? []) as ProductRecord[]) {
      const existingUrls = await getExistingUrls(supabase, product.id);

      for (const sourceType of sourceTypes) {
        if (sourceType === "own_mall") {
          if (!product.own_mall_url) {
            continue;
          }

          stats.urls_found += 1;
          const queued = await queueSource({
            supabase,
            product,
            sourceType,
            sourceUrl: product.own_mall_url,
            title: `${product.name_ko} 자사몰 상세`,
            rawText: product.description || product.name_ko,
            existingUrls,
            metadata: { provider: "own_mall" },
          });
          stats.urls_queued += queued ? 1 : 0;
          stats.duplicates_skipped += queued ? 0 : 1;
          continue;
        }

        try {
          const query = buildProductQuery(product, body.query);
          const items = await searchNaver({
            sourceType,
            query,
            display: limitPerSource,
            clientId: naverClientId,
            clientSecret: naverClientSecret,
          });

          stats.urls_found += items.length;

          for (const item of items) {
            const sourceUrl =
              sourceType === "naver_news"
                ? item.originallink || item.link
                : item.link;

            const queued = await queueSource({
              supabase,
              product,
              sourceType,
              sourceUrl: sourceUrl ?? "",
              title: stripSearchHighlightTags(item.title) || product.name_ko,
              rawText:
                stripSearchHighlightTags(item.description) ||
                stripSearchHighlightTags(item.title) ||
                product.name_ko,
              existingUrls,
              metadata: {
                provider: "naver",
                source_type: sourceType,
                query,
                bloggername: item.bloggername,
                bloggerlink: item.bloggerlink,
                postdate: item.postdate,
                pubDate: item.pubDate,
              },
            });

            stats.urls_queued += queued ? 1 : 0;
            stats.duplicates_skipped += queued ? 0 : 1;
          }
        } catch (error) {
          stats.errors.push(
            `${product.sku} ${sourceType}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      await supabase
        .from("products")
        .update({ status: "collecting" })
        .eq("id", product.id)
        .neq("status", "archived");
    }

    return jsonResponse({ ok: true, data: stats });
  } catch (error) {
    return errorResponse(error);
  }
});

function buildProductQuery(product: ProductRecord, extraQuery?: string) {
  const keywords = Array.isArray(product.cultural_keywords)
    ? product.cultural_keywords.slice(0, 2)
    : [];

  return [product.name_ko, extraQuery, ...keywords]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(" ");
}

async function searchNaver({
  sourceType,
  query,
  display,
  clientId,
  clientSecret,
}: {
  sourceType: Exclude<CollectionSourceType, "own_mall">;
  query: string;
  display: number;
  clientId: string;
  clientSecret: string;
}) {
  const config = naverConfig[sourceType];
  const params = new URLSearchParams({
    query,
    display: String(display),
    start: "1",
  });

  if (config.sort) {
    params.set("sort", config.sort);
  }

  const response = await fetch(`${config.endpoint}?${params}`, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Naver API ${response.status}: ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as { items?: NaverSearchItem[] };

  return payload.items ?? [];
}

async function getExistingUrls(
  supabase: ReturnType<typeof createServiceClient>,
  productId: string,
) {
  const { data, error } = await supabase
    .from("source_documents")
    .select("source_url")
    .eq("product_id", productId)
    .not("source_url", "is", null);

  if (error) {
    throw error;
  }

  return new Set(
    (data ?? [])
      .map((row: { source_url: string | null }) =>
        normalizeSourceUrl(row.source_url),
      )
      .filter(Boolean),
  );
}

async function queueSource({
  supabase,
  product,
  sourceType,
  sourceUrl,
  title,
  rawText,
  existingUrls,
  metadata,
}: {
  supabase: ReturnType<typeof createServiceClient>;
  product: ProductRecord;
  sourceType: CollectionSourceType;
  sourceUrl: string;
  title: string;
  rawText: string;
  existingUrls: Set<string>;
  metadata: Record<string, unknown>;
}) {
  const normalizedUrl = normalizeSourceUrl(sourceUrl);

  if (!normalizedUrl || existingUrls.has(normalizedUrl)) {
    return false;
  }

  existingUrls.add(normalizedUrl);

  const { data, error } = await supabase
    .from("source_documents")
    .insert({
      product_id: product.id,
      source_type: sourceType,
      source_url: sourceUrl,
      title,
      raw_text: rawText || title,
      markdown: null,
      extracted_metadata: {
        ...metadata,
        normalized_url: normalizedUrl,
      },
      reliability_score: reliabilityScore(sourceType),
      status: "queued",
      collected_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  const idempotencyKey = `crawl:${product.id}:${normalizedUrl}`;
  const { error: jobError } = await supabase.from("jobs").upsert(
    {
      job_type: "crawl",
      target_type: "source_document",
      target_id: data.id,
      target_name: title,
      status: "queued",
      progress: 0,
      idempotency_key: idempotencyKey,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );

  if (jobError) {
    throw jobError;
  }

  return true;
}

function reliabilityScore(sourceType: CollectionSourceType) {
  switch (sourceType) {
    case "own_mall":
      return 0.9;
    case "naver_news":
      return 0.75;
    case "naver_web":
      return 0.65;
    case "naver_blog":
      return 0.6;
  }
}
