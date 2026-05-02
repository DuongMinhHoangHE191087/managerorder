import { create } from "zustand";
import type { UserProfile } from "@/lib/types/auth";

type AuthMode = "google" | "email" | null;

const MOCK_BOOTSTRAP_DISABLED_KEY = "managerorder:disable-mock-auth-bootstrap";

function hasSupabaseAuthCookie() {
  if (typeof document === "undefined") {
    return false;
  }

  return /(?:^|;\s*)sb(?:-[^=;]+)?-auth-token(?:\.[0-9]+)?=/.test(document.cookie);
}

async function readEmailSessionUser() {
  const response = await fetch("/api/auth/session/me", {
    credentials: "include",
  });
  if (!response.ok) {
    return null;
  }

  const { data } = (await response.json()) as { data?: UserProfile | null };
  return data ?? null;
}

async function readGoogleSessionUser() {
  if (!hasSupabaseAuthCookie()) {
    return null;
  }

  const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email || "",
    firstName: user.user_metadata?.full_name?.split(" ")[0] || "",
    lastName: user.user_metadata?.full_name?.split(" ").slice(1).join(" ") || "",
    role: "admin",
    accountId: "",
    createdAt: new Date(user.created_at),
  } satisfies UserProfile;
}

function canBootstrapMockSession() {
  if (typeof window === "undefined") {
    return false;
  }

  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  if (window.location.pathname === "/login") {
    return false;
  }

  return window.localStorage.getItem(MOCK_BOOTSTRAP_DISABLED_KEY) !== "1";
}

async function bootstrapMockSessionUser() {
  if (!canBootstrapMockSession()) {
    return null;
  }

  const response = await fetch("/api/auth/session/mock", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

  if (!response.ok) {
    return null;
  }

  return await readEmailSessionUser();
}

function setMockBootstrapDisabled(disabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (disabled) {
      window.localStorage.setItem(MOCK_BOOTSTRAP_DISABLED_KEY, "1");
    } else {
      window.localStorage.removeItem(MOCK_BOOTSTRAP_DISABLED_KEY);
    }
  } catch {
    // Ignore storage failures in privacy-restricted browsers.
  }
}

let bootstrapPromise: Promise<void> | null = null;

interface AuthState {
  user: UserProfile | null;
  authMode: AuthMode;
  isLoading: boolean;
  isInitialized: boolean;

  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  setGoogleUser: (user: UserProfile) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  authMode: null,
  isLoading: false,
  isInitialized: false,

  loginWithEmail: async (email: string, password: string) => {
    set({ isLoading: true });

    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = typeof errorBody.error === "string"
          ? errorBody.error
          : errorBody.error?.message || "Đăng nhập thất bại";
        throw new Error(message);
      }

      const { data } = (await response.json()) as { data: { user: UserProfile } };
      set({
        user: data.user,
        authMode: "email",
        isLoading: false,
        isInitialized: true,
      });
      setMockBootstrapDisabled(false);
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });

    const clearLocalState = () => {
      set({ user: null, authMode: null, isLoading: false, isInitialized: false });
    };

    try {
      await fetch("/api/auth/session", {
        method: "DELETE",
        credentials: "include",
      });

      try {
        if (hasSupabaseAuthCookie()) {
          const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signOut({ scope: "global" });
        }
      } catch {
        // Supabase sign-out is best-effort only.
      }

      setMockBootstrapDisabled(true);
      clearLocalState();
    } catch {
      setMockBootstrapDisabled(true);
      clearLocalState();
    }
  },

  initialize: async () => {
    if (get().isInitialized) {
      return;
    }

    if (bootstrapPromise) {
      return bootstrapPromise;
    }

    bootstrapPromise = (async () => {
      set({ isLoading: true });

      try {
        const emailUser = await readEmailSessionUser();
        if (emailUser) {
          set({
            user: emailUser,
            authMode: "email",
            isLoading: false,
            isInitialized: true,
          });
          return;
        }

        const googleUser = await readGoogleSessionUser();
        if (googleUser) {
          set({
            user: googleUser,
            authMode: "google",
            isLoading: false,
            isInitialized: true,
          });
          setMockBootstrapDisabled(false);
          return;
        }

        const mockUser = await bootstrapMockSessionUser();
        if (mockUser) {
          set({
            user: mockUser,
            authMode: "email",
            isLoading: false,
            isInitialized: true,
          });
          setMockBootstrapDisabled(false);
          return;
        }

        set({ user: null, authMode: null, isLoading: false, isInitialized: true });
      } catch {
        set({ user: null, authMode: null, isLoading: false, isInitialized: true });
      } finally {
        bootstrapPromise = null;
      }
    })();

    return bootstrapPromise;
  },

  setGoogleUser: (user: UserProfile) => {
    set({ user, authMode: "google", isInitialized: true });
    setMockBootstrapDisabled(false);
  },

  clear: () => {
    set({ user: null, authMode: null, isLoading: false, isInitialized: false });
  },
}));
