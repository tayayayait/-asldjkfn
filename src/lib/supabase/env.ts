type SupabaseEnvRecord = Record<string, string | undefined>;

export function sanitizeSupabaseUrl(value: string) {
  return value.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

function requireEnv(name: string, value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`Missing Supabase environment variable: ${name}`);
  }

  return normalized;
}

export function getBrowserSupabaseEnv(env: SupabaseEnvRecord) {
  return {
    url: sanitizeSupabaseUrl(
      requireEnv("VITE_SUPABASE_URL", env.VITE_SUPABASE_URL),
    ),
    anonKey: requireEnv("VITE_SUPABASE_ANON_KEY", env.VITE_SUPABASE_ANON_KEY),
  };
}

export function getServerSupabaseEnv(env: SupabaseEnvRecord) {
  return {
    url: sanitizeSupabaseUrl(requireEnv("SUPABASE_URL", env.SUPABASE_URL)),
    serviceRoleKey: requireEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}
