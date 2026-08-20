export type AppMode = "demo" | "production";

export interface AppConfig {
  mode: AppMode;
  isDemo: boolean;
  isProduction: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  hasSupabaseConfig: boolean;
}

const rawEnvMode = (process.env.NEXT_PUBLIC_APP_MODE || "demo").toLowerCase().trim();
const isExplicitProduction = rawEnvMode === "production";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

const hasSupabaseConfig = Boolean(
  supabaseUrl &&
    supabaseUrl !== "https://your-project.supabase.co" &&
    supabaseAnonKey &&
    supabaseAnonKey !== "your-anon-key-here"
);

// If production mode is requested but Supabase credentials are not configured, FAIL LOUDLY
if (isExplicitProduction && !hasSupabaseConfig) {
  const errorMsg =
    "[FATAL CONFIGURATION ERROR] Application is configured with NEXT_PUBLIC_APP_MODE='production' " +
    "but valid NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY were not found. " +
    "Production mode is strictly isolated and will NEVER silently fall back to demo opportunities.";

  console.error(errorMsg);
  // Only throw in browser/server runtime when explicitly running in production
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    throw new Error(errorMsg);
  }
}

export const appConfig: AppConfig = {
  mode: isExplicitProduction ? "production" : "demo",
  isDemo: !isExplicitProduction,
  isProduction: isExplicitProduction,
  supabaseUrl,
  supabaseAnonKey,
  hasSupabaseConfig,
};

/**
 * Validates that production mode prerequisites are satisfied.
 * Throws a loud exception if misconfigured.
 */
export function assertProductionConfig(): void {
  if (appConfig.isProduction && !appConfig.hasSupabaseConfig) {
    throw new Error(
      "[FATAL CONFIGURATION ERROR] Production mode requires active Supabase configuration. " +
        "Please provide NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment."
    );
  }
}

/**
 * Diagnostic status description
 */
export function getAppModeDescription(): string {
  if (appConfig.isProduction) {
    if (!appConfig.hasSupabaseConfig) {
      return "⚠️ PRODUCTION MISCONFIGURED: NEXT_PUBLIC_APP_MODE is production but Supabase keys are missing!";
    }
    return "🚀 PRODUCTION MODE: Connected to live Supabase database with real auth & persistent RLS.";
  }
  return "🧪 DEMO MODE: Safe offline-ready prototype using verified demo dataset and local state fallback.";
}
