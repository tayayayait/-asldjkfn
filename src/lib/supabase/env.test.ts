import { describe, expect, it } from "vitest";

import {
  getBrowserSupabaseEnv,
  getServerSupabaseEnv,
  sanitizeSupabaseUrl,
} from "./env";

describe("Supabase environment helpers", () => {
  it("strips REST API suffix from Supabase project URLs", () => {
    expect(
      sanitizeSupabaseUrl("https://emzbflouaazgywsdoore.supabase.co/rest/v1/"),
    ).toBe("https://emzbflouaazgywsdoore.supabase.co");
  });

  it("returns browser URL and anon key from VITE variables", () => {
    const env = getBrowserSupabaseEnv({
      VITE_SUPABASE_URL: "https://example.supabase.co/rest/v1/",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(env).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("returns server URL and service role key from server variables", () => {
    const env = getServerSupabaseEnv({
      SUPABASE_URL: "https://example.supabase.co/",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });

    expect(env).toEqual({
      url: "https://example.supabase.co",
      serviceRoleKey: "service-role-key",
    });
  });

  it("throws a specific error when a required variable is missing", () => {
    expect(() => getBrowserSupabaseEnv({})).toThrow(
      "Missing Supabase environment variable: VITE_SUPABASE_URL",
    );
  });
});
