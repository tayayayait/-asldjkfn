import { requireEnv } from "./http.ts";

type GeminiEmbeddingResponse = {
  embedding?: {
    values?: number[];
  };
  embeddings?: Array<{
    values?: number[];
  }>;
  error?: unknown;
};

export type EmbeddingPurpose = "document" | "query";

export function getEmbeddingModel() {
  return Deno.env.get("GEMINI_EMBEDDING_MODEL") || "gemini-embedding-2";
}

export function formatEmbeddingForPostgres(values: number[]) {
  if (values.length === 0) {
    throw new Error("Embedding vector is empty");
  }

  return `[${values
    .map((value) => {
      if (!Number.isFinite(value)) {
        throw new Error("Embedding contains a non-finite value");
      }

      return Number(value).toString();
    })
    .join(",")}]`;
}

export async function generateGeminiEmbedding(
  text: string,
  purpose: EmbeddingPurpose,
) {
  const model = getEmbeddingModel();
  const prompt =
    purpose === "query"
      ? `Represent this search query for retrieving Korean traditional culture product source chunks:\n${text}`
      : `Represent this document chunk for retrieval in a Korean traditional culture product RAG system:\n${text}`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": requireEnv("GEMINI_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: prompt }],
        },
        output_dimensionality: 768,
      }),
    },
  );
  const payload = (await response.json()) as GeminiEmbeddingResponse;

  if (!response.ok) {
    throw new Error(`Gemini embedding API ${response.status}: ${JSON.stringify(payload)}`);
  }

  const values = payload.embedding?.values ?? payload.embeddings?.[0]?.values;

  if (!values || values.length === 0) {
    throw new Error("Gemini embedding response did not include values");
  }

  if (values.length !== 768) {
    throw new Error(`Expected 768-dimension embedding, received ${values.length}`);
  }

  return {
    model,
    values,
    vector: formatEmbeddingForPostgres(values),
  };
}
