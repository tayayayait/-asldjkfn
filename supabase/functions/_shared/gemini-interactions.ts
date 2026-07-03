export type GeminiInteractionResponse = {
  id?: string;
  output_text?: string;
  text?: string;
  usage_metadata?: Record<string, unknown>;
  usageMetadata?: Record<string, unknown>;
  steps?: Array<{
    type?: string;
    status?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: unknown;
};

export function extractGeminiInteractionText(
  payload: GeminiInteractionResponse,
) {
  const directText = payload.output_text ?? payload.text;

  if (directText?.trim()) {
    return directText.trim();
  }

  const stepText = extractModelOutputStepText(payload.steps);

  if (stepText) {
    return stepText;
  }

  const candidateText = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  return candidateText || undefined;
}

function extractModelOutputStepText(
  steps: GeminiInteractionResponse["steps"],
) {
  if (!steps) {
    return undefined;
  }

  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];

    if (step.type !== "model_output" || step.status === "failed") {
      continue;
    }

    const text = step.content
      ?.filter((part) => !part.type || part.type === "text")
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (text) {
      return text;
    }
  }

  return undefined;
}
