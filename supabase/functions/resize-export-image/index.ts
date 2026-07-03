import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readJson,
} from "../_shared/http.ts";

type ExportImageRequest = {
  image_generation_id?: string;
  imageGenerationId?: string;
  sizes?: ExportSizeKey[];
};

type ExportSizeKey =
  | "instagram_square"
  | "instagram_portrait"
  | "instagram_story"
  | "wide";

type ExportSizeSpec = {
  key: ExportSizeKey;
  width: number;
  height: number;
  label: string;
};

type ImageGenerationRecord = {
  id: string;
  product_id: string;
  generated_file_path: string | null;
};

const exportSizes: Record<ExportSizeKey, ExportSizeSpec> = {
  instagram_square: {
    key: "instagram_square",
    width: 1080,
    height: 1080,
    label: "Instagram 1:1",
  },
  instagram_portrait: {
    key: "instagram_portrait",
    width: 1080,
    height: 1350,
    label: "Instagram 4:5",
  },
  instagram_story: {
    key: "instagram_story",
    width: 1080,
    height: 1920,
    label: "Story 9:16",
  },
  wide: {
    key: "wide",
    width: 1920,
    height: 1080,
    label: "Wide 16:9",
  },
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await readJson<ExportImageRequest>(request);
    const imageGenerationId =
      body.image_generation_id ?? body.imageGenerationId;
    const sizes = normalizeSizes(body.sizes);

    if (!imageGenerationId) {
      throw new Error("image_generation_id is required");
    }

    const supabase = createServiceClient();
    const { data: image, error: imageError } = await supabase
      .from("image_generations")
      .select("id, product_id, generated_file_path")
      .eq("id", imageGenerationId)
      .single();

    if (imageError) {
      throw imageError;
    }

    const record = image as ImageGenerationRecord;

    if (!record.generated_file_path) {
      throw new Error("Image generation does not have a generated_file_path");
    }

    const files = [];

    for (const size of sizes) {
      const bytes = await downloadTransformedImage(
        supabase,
        record.generated_file_path,
        size,
      );
      const path = `exports/${record.product_id}/${record.id}-${size.key}.png`;
      const { error: uploadError } = await supabase.storage
        .from("approved-public-assets")
        .upload(path, bytes, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrl } = supabase.storage
        .from("approved-public-assets")
        .getPublicUrl(path);

      files.push({
        size_key: size.key,
        label: size.label,
        width: size.width,
        height: size.height,
        path,
        url: publicUrl.publicUrl,
      });
    }

    await supabase
      .from("image_generations")
      .update({ status: "exported" })
      .eq("id", record.id);

    return jsonResponse({
      ok: true,
      data: { files },
    });
  } catch (error) {
    return errorResponse(error);
  }
});

function normalizeSizes(value: ExportSizeKey[] | undefined) {
  const keys = value?.length
    ? value
    : (["instagram_square", "instagram_portrait", "instagram_story", "wide"] as ExportSizeKey[]);

  return keys.map((key) => exportSizes[key]).filter(Boolean);
}

async function downloadTransformedImage(
  supabase: ReturnType<typeof createServiceClient>,
  path: string,
  size: ExportSizeSpec,
) {
  const { data: signed, error: signedError } = await supabase.storage
    .from("generated-images")
    .createSignedUrl(path, 60, {
      transform: {
        width: size.width,
        height: size.height,
        resize: "cover",
      },
    });

  if (!signedError && signed?.signedUrl) {
    const response = await fetch(signed.signedUrl);

    if (response.ok) {
      return new Uint8Array(await response.arrayBuffer());
    }
  }

  const { data, error } = await supabase.storage
    .from("generated-images")
    .download(path);

  if (error) {
    throw error;
  }

  return new Uint8Array(await data.arrayBuffer());
}
