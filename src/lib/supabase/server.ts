import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { getServerSupabaseEnv } from "./env";

export function createServerSupabase(env = process.env) {
  const { url, serviceRoleKey } = getServerSupabaseEnv(env);

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
