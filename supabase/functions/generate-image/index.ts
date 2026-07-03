import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readJson,
  requireEnv,
} from "../_shared/http.ts";

type GenerateImageRequest = {
  product_id?: string;
  productId?: string;
  original_asset_id?: string;
  originalAssetId?: string;
  concept?: string;
  background_tone?: string;
  backgroundTone?: string;
  aspect_ratio?: string;
  aspectRatio?: string;
  preserve_rules?: string[];
  preserveRules?: string[];
  exclude_elements?: string[];
  excludeElements?: string[];
  custom_prompt?: string;
  customPrompt?: string;
};

type ProductRecord = {
  id: string;
  sku: string;
  name_ko: string;
  category: string;
  cultural_keywords: string[];
};

type ProductAssetRecord = {
  id: string;
  product_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
};

type PromptTemplateRecord = {
  template_body: string;
};

type GeminiImageResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
        inline_data?: {
          mime_type?: string;
          data?: string;
        };
      }>;
    };
  }>;
  error?: unknown;
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
    const body = await readJson<GenerateImageRequest>(request);
    productId = body.product_id ?? body.productId;
    const originalAssetId = body.original_asset_id ?? body.originalAssetId;
    const concept = body.concept?.trim() || "premium product catalog";
    const backgroundTone =
      body.background_tone?.trim() ?? body.backgroundTone?.trim() ?? "neutral";
    const aspectRatio = normalizeAspectRatio(
      body.aspect_ratio ?? body.aspectRatio ?? "1:1",
    );
    const preserveRules = body.preserve_rules ?? body.preserveRules ?? [];
    const excludeElements = body.exclude_elements ?? body.excludeElements ?? [];
    const customPrompt =
      body.custom_prompt?.trim() ?? body.customPrompt?.trim() ?? "";

    if (!productId) {
      throw new Error("product_id is required");
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, sku, name_ko, category, cultural_keywords")
      .eq("id", productId)
      .single();

    if (productError) {
      throw productError;
    }

    const productRecord = product as ProductRecord;
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        job_type: "generate_image",
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

    const originalAsset = originalAssetId
      ? await fetchOriginalAsset(supabase, originalAssetId, productId)
      : null;
    const promptTemplate = await fetchImagePromptTemplate(supabase);
    const prompt = renderImagePrompt(
      promptTemplate?.template_body ??
        "Create a premium image for {{product_name}}.\nKeywords: {{keywords}}\nConcept: {{concept}}\nBackground: {{background_tone}}\nPreserve: {{preserve_rules}}\nExclude: {{exclude_elements}}\n{{custom_prompt}}",
      {
        product_name: productRecord.name_ko,
        keywords: productRecord.cultural_keywords.join(", "),
        concept,
        background_tone: backgroundTone,
        preserve_rules: preserveRules.join(", "),
        exclude_elements: excludeElements.join(", "),
        custom_prompt: customPrompt,
      },
    );
    const originalImage = originalAsset
      ? await downloadAssetAsBase64(supabase, originalAsset)
      : null;
    await supabase.from("jobs").update({ progress: 45 }).eq("id", jobId);

    const generated = await generateGeminiImage({
      prompt,
      aspectRatio,
      originalImage,
    });
    const generationId = crypto.randomUUID();
    const filePath = `products/${productId}/${generationId}.png`;
    const imageBytes = base64ToBytes(generated.data);
    const { error: uploadError } = await supabase.storage
      .from("generated-images")
      .upload(filePath, imageBytes, {
        contentType: generated.mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("image_generations")
      .insert({
        id: generationId,
        product_id: productId,
        original_asset_id: originalAsset?.id ?? null,
        concept,
        background_tone: backgroundTone,
        aspect_ratio: aspectRatio,
        preserve_rules: preserveRules,
        exclude_elements: excludeElements,
        prompt_used: prompt,
        model: generated.model,
        generated_file_path: filePath,
        thumbnail_path: filePath,
        status: "review_pending",
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    await supabase
      .from("products")
      .update({ status: "image_ready" })
      .eq("id", productId)
      .in("status", ["content_ready", "knowledge_ready", "review_required"]);

    await completeJob(supabase, jobId, "completed", 100);

    return jsonResponse({
      ok: true,
      data: inserted,
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

async function fetchOriginalAsset(
  supabase: ReturnType<typeof createServiceClient>,
  assetId: string,
  productId: string,
) {
  const { data, error } = await supabase
    .from("product_assets")
    .select("id, product_id, file_path, file_name, mime_type")
    .eq("id", assetId)
    .eq("product_id", productId)
    .single();

  if (error) {
    throw error;
  }

  return data as ProductAssetRecord;
}

async function fetchImagePromptTemplate(
  supabase: ReturnType<typeof createServiceClient>,
) {
  const { data, error } = await supabase
    .from("prompt_templates")
    .select("template_body")
    .eq("purpose", "image_generation")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] as PromptTemplateRecord | undefined;
}

async function downloadAssetAsBase64(
  supabase: ReturnType<typeof createServiceClient>,
  asset: ProductAssetRecord,
) {
  const { data, error } = await supabase.storage
    .from("product-originals")
    .download(asset.file_path);

  if (error) {
    throw error;
  }

  return {
    mimeType: asset.mime_type || "image/png",
    data: await blobToBase64(data),
  };
}

async function generateGeminiImage(params: {
  prompt: string;
  aspectRatio: string;
  originalImage: { mimeType: string; data: string } | null;
}) {
  const model = Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-3.1-flash-image";
  const parts: Array<Record<string, unknown>> = [];

  if (params.originalImage) {
    parts.push({
      inline_data: {
        mime_type: params.originalImage.mimeType,
        data: params.originalImage.data,
      },
    });
  }

  parts.push({ text: params.prompt });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": requireEnv("GEMINI_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: {
            aspectRatio: params.aspectRatio,
          },
        },
      }),
    },
  );
  const payload = (await response.json()) as GeminiImageResponse;

  if (!response.ok) {
    throw new Error(`Gemini image API ${response.status}: ${JSON.stringify(payload)}`);
  }

  const imagePart = payload.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData?.data || part.inline_data?.data,
  );
  const data = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;
  const mimeType =
    imagePart?.inlineData?.mimeType ??
    imagePart?.inline_data?.mime_type ??
    "image/png";

  if (!data) {
    throw new Error("Gemini image response did not include image data");
  }

  return { model, data, mimeType };
}

function renderImagePrompt(template: string, variables: Record<string, string>) {
  return template.replace(
    /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g,
    (_match, variable: string) => variables[variable] ?? "",
  );
}

function normalizeAspectRatio(value: string) {
  const normalized = value.trim().replace("x", ":");

  return ["1:1", "4:5", "9:16", "16:9"].includes(normalized)
    ? normalized
    : "1:1";
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
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
      progress,
      last_error: lastError ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}
