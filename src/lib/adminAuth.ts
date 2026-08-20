import { getSupabaseClient } from "@/lib/supabase/client";
import { appConfig } from "./config";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "admin@opportune.edu,reviewer@opportune.edu").split(",");

export interface AdminAuthResult {
  isAuthorized: boolean;
  userEmail?: string;
  role?: string;
  reason?: string;
}

export const adminAuth = {
  /**
   * Evaluates administrator authorization.
   * In Production: Strictly validates Supabase session & user role/email against admin registry.
   * In Demo Mode: Grants evaluation access with demo staff badge.
   */
  async verifyAdminAccess(adminPasscode?: string): Promise<AdminAuthResult> {
    // Check demo mode evaluation bypass
    if (appConfig.isDemo) {
      if (adminPasscode && adminPasscode === "admin2026") {
        return {
          isAuthorized: true,
          userEmail: "demo-admin@opportune.edu",
          role: "super_admin",
        };
      }
      return {
        isAuthorized: true,
        userEmail: "demo-staff@opportune.edu",
        role: "admin",
      };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        isAuthorized: false,
        reason: "Supabase authentication client not configured for production mode.",
      };
    }

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return {
          isAuthorized: false,
          reason: "User not authenticated. Please log in with your administrative account.",
        };
      }

      const role = user.app_metadata?.role || user.user_metadata?.role;
      const isEmailAdmin = user.email && ADMIN_EMAILS.includes(user.email);

      if (role === "admin" || role === "super_admin" || isEmailAdmin) {
        return {
          isAuthorized: true,
          userEmail: user.email,
          role: role || "admin",
        };
      }

      return {
        isAuthorized: false,
        reason: "Access denied. Your account lacks administrator privileges.",
      };
    } catch (e: any) {
      return {
        isAuthorized: false,
        reason: `Authentication verification error: ${e.message}`,
      };
    }
  },
};
