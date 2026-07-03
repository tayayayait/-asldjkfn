export const DEMO_PROFILE_ID = "00000000-0000-0000-0000-000000000001";
export const DEMO_PROFILE_EMAIL = "demo-admin@example.local";
export const DEMO_PROFILE_NAME = "Demo Admin";

type AuthLookupError = {
  name?: string;
  message?: string;
};

type AuthLookupUser = {
  id?: string;
} | null;

export function isMissingAuthSessionError(
  error: AuthLookupError | null | undefined,
) {
  if (!error) {
    return false;
  }

  const value = `${error.name ?? ""} ${error.message ?? ""}`.toLowerCase();

  return (
    value.includes("authsessionmissingerror") ||
    value.includes("auth session missing")
  );
}

export function resolveUserIdOrDemo(
  user: AuthLookupUser | undefined,
  error: AuthLookupError | null | undefined,
) {
  if (error && !isMissingAuthSessionError(error)) {
    throw error;
  }

  return user?.id ?? DEMO_PROFILE_ID;
}
