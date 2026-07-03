import { supabase } from "@/lib/supabase/client";
import { resolveUserIdOrDemo } from "@/lib/auth/demo-user";
import type { Database } from "@/lib/supabase/database.types";

export type PromptTemplate =
  Database["public"]["Tables"]["prompt_templates"]["Row"];
export type PromptTemplateInsert =
  Database["public"]["Tables"]["prompt_templates"]["Insert"];

export type PromptTemplateFilters = {
  purpose?: string | "all";
  language?: string | "all";
  channel?: string | "all";
  tone?: string | "all";
  search?: string;
  isActive?: boolean | "all";
};

export type PromptTemplateInput = {
  purpose: string;
  language: string;
  channel: string;
  tone: string;
  templateBody: string;
  variables?: string[];
  isActive?: boolean;
};

export type PromptTemplateVersionInput = Partial<PromptTemplateInput>;

export const PROMPT_PURPOSE_LABELS: Record<string, string> = {
  product_detail: "상품 상세",
  sns_caption: "SNS 캡션",
  ad_copy: "광고 문안",
  email_card: "이메일 카드",
  blog_post: "블로그",
  image_generation: "이미지 만들기",
};

export const PROMPT_LANGUAGE_LABELS: Record<string, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  "zh-CN": "简体中文",
};

export const PROMPT_CHANNEL_LABELS: Record<string, string> = {
  own_mall: "자사몰",
  instagram: "Instagram",
  blog: "블로그",
  newsletter: "뉴스레터",
  ads: "광고",
  image: "이미지",
};

const VARIABLE_PATTERN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

export function extractPromptVariables(template: string) {
  const variables: string[] = [];
  const seen = new Set<string>();

  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const variable = match[1];

    if (!seen.has(variable)) {
      seen.add(variable);
      variables.push(variable);
    }
  }

  return variables;
}

export function renderPromptTemplate(
  template: string,
  variables: Record<string, unknown>,
) {
  return template.replace(VARIABLE_PATTERN, (_match, variable: string) => {
    const value = variables[variable];

    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing prompt variable: ${variable}`);
    }

    if (Array.isArray(value)) {
      return value.join(", ");
    }

    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  });
}

export function nextPromptVersion(existing: Array<Pick<PromptTemplate, "version">>) {
  if (existing.length === 0) {
    return 1;
  }

  return Math.max(...existing.map((template) => template.version)) + 1;
}

function escapePostgrestLike(value: string) {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function normalizeCombo(input: {
  purpose: string;
  language: string;
  channel: string;
  tone: string;
}) {
  return {
    purpose: input.purpose.trim(),
    language: input.language.trim(),
    channel: input.channel.trim(),
    tone: input.tone.trim(),
  };
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();

  return resolveUserIdOrDemo(data.user, error);
}

async function fetchPromptVersions(combo: {
  purpose: string;
  language: string;
  channel: string;
  tone: string;
}) {
  const { data, error } = await supabase
    .from("prompt_templates")
    .select("version")
    .eq("purpose", combo.purpose)
    .eq("language", combo.language)
    .eq("channel", combo.channel)
    .eq("tone", combo.tone);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function deactivateMatchingTemplates(combo: {
  purpose: string;
  language: string;
  channel: string;
  tone: string;
}) {
  const { error } = await supabase
    .from("prompt_templates")
    .update({ is_active: false })
    .eq("purpose", combo.purpose)
    .eq("language", combo.language)
    .eq("channel", combo.channel)
    .eq("tone", combo.tone);

  if (error) {
    throw error;
  }
}

export async function fetchPromptTemplates(
  filters: PromptTemplateFilters = {},
) {
  let query = supabase
    .from("prompt_templates")
    .select("*")
    .order("purpose", { ascending: true })
    .order("language", { ascending: true })
    .order("channel", { ascending: true })
    .order("tone", { ascending: true })
    .order("version", { ascending: false });

  if (filters.purpose && filters.purpose !== "all") {
    query = query.eq("purpose", filters.purpose);
  }

  if (filters.language && filters.language !== "all") {
    query = query.eq("language", filters.language);
  }

  if (filters.channel && filters.channel !== "all") {
    query = query.eq("channel", filters.channel);
  }

  if (filters.tone && filters.tone !== "all") {
    query = query.eq("tone", filters.tone);
  }

  if (filters.isActive !== undefined && filters.isActive !== "all") {
    query = query.eq("is_active", filters.isActive);
  }

  const search = filters.search?.trim();

  if (search) {
    const pattern = `%${escapePostgrestLike(search)}%`;
    query = query.or(
      `purpose.ilike.${pattern},language.ilike.${pattern},channel.ilike.${pattern},tone.ilike.${pattern},template_body.ilike.${pattern}`,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchPromptTemplate(id: string) {
  const { data, error } = await supabase
    .from("prompt_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createPromptTemplate(input: PromptTemplateInput) {
  const combo = normalizeCombo(input);
  const templateBody = input.templateBody.trim();

  if (!templateBody) {
    throw new Error("Prompt template body is required");
  }

  const [existingVersions, userId] = await Promise.all([
    fetchPromptVersions(combo),
    getCurrentUserId(),
  ]);
  const isActive = input.isActive ?? true;

  if (isActive) {
    await deactivateMatchingTemplates(combo);
  }

  const payload: PromptTemplateInsert = {
    ...combo,
    template_body: templateBody,
    variables: input.variables ?? extractPromptVariables(templateBody),
    version: nextPromptVersion(existingVersions),
    is_active: isActive,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from("prompt_templates")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createPromptTemplateVersion(
  id: string,
  input: PromptTemplateVersionInput,
) {
  const base = await fetchPromptTemplate(id);
  const combo = normalizeCombo({
    purpose: input.purpose ?? base.purpose,
    language: input.language ?? base.language,
    channel: input.channel ?? base.channel,
    tone: input.tone ?? base.tone,
  });
  const templateBody = (input.templateBody ?? base.template_body).trim();

  if (!templateBody) {
    throw new Error("Prompt template body is required");
  }

  const [existingVersions, userId] = await Promise.all([
    fetchPromptVersions(combo),
    getCurrentUserId(),
  ]);
  const isActive = input.isActive ?? true;

  if (isActive) {
    await deactivateMatchingTemplates(combo);
  }

  const { data, error } = await supabase
    .from("prompt_templates")
    .insert({
      ...combo,
      template_body: templateBody,
      variables: input.variables ?? extractPromptVariables(templateBody),
      version: nextPromptVersion(existingVersions),
      is_active: isActive,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updatePromptTemplate(
  id: string,
  input: Partial<PromptTemplateInput>,
) {
  const payload: Record<string, unknown> = {};

  if (input.purpose !== undefined) {
    payload.purpose = input.purpose.trim();
  }

  if (input.language !== undefined) {
    payload.language = input.language.trim();
  }

  if (input.channel !== undefined) {
    payload.channel = input.channel.trim();
  }

  if (input.tone !== undefined) {
    payload.tone = input.tone.trim();
  }

  if (input.templateBody !== undefined) {
    const templateBody = input.templateBody.trim();

    if (!templateBody) {
      throw new Error("Prompt template body is required");
    }

    payload.template_body = templateBody;
    payload.variables = input.variables ?? extractPromptVariables(templateBody);
  } else if (input.variables !== undefined) {
    payload.variables = input.variables;
  }

  if (input.isActive !== undefined) {
    payload.is_active = input.isActive;
  }

  const { data, error } = await supabase
    .from("prompt_templates")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function togglePromptActive(id: string, isActive: boolean) {
  if (isActive) {
    const template = await fetchPromptTemplate(id);
    await deactivateMatchingTemplates(template);
  }

  const { data, error } = await supabase
    .from("prompt_templates")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deletePromptTemplate(id: string) {
  const { error } = await supabase.from("prompt_templates").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function testPromptTemplate(
  id: string,
  variables: Record<string, unknown>,
) {
  const template = await fetchPromptTemplate(id);

  return renderPromptTemplate(template.template_body, variables);
}
