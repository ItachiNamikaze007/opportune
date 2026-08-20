import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Checks if Supabase credentials are configured in the environment.
 */
export function isSupabaseConfigured(): boolean {
  return (
    typeof supabaseUrl === "string" &&
    supabaseUrl.trim().length > 0 &&
    !supabaseUrl.includes("your-supabase-project") &&
    typeof supabaseAnonKey === "string" &&
    supabaseAnonKey.trim().length > 0 &&
    !supabaseAnonKey.includes("your-anon-key")
  );
}

let supabaseInstance: SupabaseClient | null = null;

/**
 * Returns the initialized Supabase client, or null if unconfigured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return supabaseInstance;
}

/**
 * Authentication Helpers with Graceful Fallback
 */
export const authService = {
  async signInWithEmail(email: string, password?: string) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      // Demo/Local mock fallback
      return { data: { user: { id: "mock-student-id", email } }, error: null };
    }

    if (password) {
      return await supabase.auth.signInWithPassword({ email, password });
    } else {
      return await supabase.auth.signInWithOtp({ email });
    }
  },

  async signUpWithEmail(email: string, password?: string, fullName?: string) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      // Demo/Local mock fallback
      return { data: { user: { id: "mock-student-id", email, user_metadata: { full_name: fullName } } }, error: null };
    }

    return await supabase.auth.signUp({
      email,
      password: password || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "AuthTemp!" + Math.random().toString(36).slice(2)),
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
  },

  async signInWithGoogle() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      // Demo/Local mock fallback
      return { data: { provider: "google", url: null }, error: null };
    }

    return await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined,
      },
    });
  },

  async signOut() {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    return { error: null };
  },

  async getCurrentUser() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return null;
    }
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },
};
