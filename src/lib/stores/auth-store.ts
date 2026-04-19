import { create } from "zustand";
import type { UserProfile } from "@/lib/types/auth";

type AuthMode = "google" | "email" | null;

function hasSupabaseAuthCookie() {
  if (typeof document === "undefined") {
    return false;
  }

  return /(?:^|;\s*)sb(?:-[^=;]+)?-auth-token(?:\.[0-9]+)?=/.test(document.cookie);
}

async function readEmailSessionUser() {
  const response = await fetch("/api/auth/session/me");
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
      await fetch("/api/auth/session", { method: "DELETE" });

      try {
        if (hasSupabaseAuthCookie()) {
          const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signOut({ scope: "global" });
        }
      } catch {
        // Supabase sign-out is best-effort only.
      }

      clearLocalState();
    } catch {
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
  },

  clear: () => {
    set({ user: null, authMode: null, isLoading: false, isInitialized: false });
  },
}));
