import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";

import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DEMO_PROFILE_EMAIL,
  DEMO_PROFILE_ID,
  DEMO_PROFILE_NAME,
} from "./demo-user";
import { canAccessPath, type AuthRole } from "./roles";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AuthRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const demoProfile: Profile = {
  id: DEMO_PROFILE_ID,
  email: DEMO_PROFILE_EMAIL,
  name: DEMO_PROFILE_NAME,
  role: "admin",
  avatar_url: null,
  is_active: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

const emptyAuthState: AuthState = {
  user: null,
  session: null,
  profile: null,
  role: null,
  isLoading: true,
  isAuthenticated: false,
};

const demoAuthState: AuthState = {
  user: null,
  session: null,
  profile: demoProfile,
  role: "admin",
  isLoading: false,
  isAuthenticated: true,
};

function isAuthRole(value: string | null | undefined): value is AuthRole {
  return (
    value === "admin" ||
    value === "manager" ||
    value === "editor" ||
    value === "reviewer" ||
    value === "viewer"
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(emptyAuthState);

  const loadProfile = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setAuthState(demoAuthState);
      return;
    }

    const client = getSupabaseBrowserClient();
    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error) {
      setAuthState(demoAuthState);
      return;
    }

    const role = isAuthRole(data.role) ? data.role : "viewer";

    setAuthState({
      user: session.user,
      session,
      profile: data,
      role,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(authState.session);
  }, [authState.session, loadProfile]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const client = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await client.auth.getSession();

        if (isMounted) {
          await loadProfile(session);
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setAuthState(demoAuthState);
        }
      }
    };

    void initialize();

    let unsubscribe = () => {};

    try {
      const client = getSupabaseBrowserClient();
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          setAuthState(demoAuthState);
          return;
        }

        void loadProfile(session).catch((error) => {
          console.error(error);
          toast.error("로그인 정보를 불러오지 못했습니다.");
          setAuthState(demoAuthState);
        });
      });

      unsubscribe = () => subscription.unsubscribe();
    } catch (error) {
      console.error(error);
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const client = getSupabaseBrowserClient();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      await loadProfile(data.session);
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    await client.auth.signOut();
    setAuthState(demoAuthState);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...authState,
      signIn,
      signOut,
      refreshProfile,
    }),
    [authState, refreshProfile, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export function useRequireAuth() {
  const auth = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && pathname !== "/login") {
      void navigate({ to: "/login", replace: true });
    }
  }, [auth.isAuthenticated, auth.isLoading, navigate, pathname]);

  return auth;
}

export function useRequireRole(allowedRoles: AuthRole[]) {
  const auth = useRequireAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (
      !auth.isLoading &&
      auth.isAuthenticated &&
      !allowedRoles.some((role) => role === auth.role)
    ) {
      toast.error("이 작업을 수행할 권한이 없습니다.");
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [allowedRoles, auth.isAuthenticated, auth.isLoading, auth.role, navigate]);

  useEffect(() => {
    if (
      !auth.isLoading &&
      auth.isAuthenticated &&
      !canAccessPath(auth.role, pathname)
    ) {
      toast.error("접근 권한이 없는 화면입니다.");
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.role, navigate, pathname]);

  return auth;
}
