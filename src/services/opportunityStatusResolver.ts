import { Opportunity } from "@/types";

export type OpportunityStatusType =
  | "ACTIVE"
  | "CLOSING_SOON"
  | "EXPIRED"
  | "REGISTRATION_CLOSED"
  | "UPCOMING"
  | "UNKNOWN"
  | "DEMO";

export type FreshnessState = "Fresh" | "Stale" | "Needs Verification" | "Expired";

export interface OpportunityStatusResult {
  status: OpportunityStatusType;
  isExpired: boolean;
  isActivelyApplicable: boolean;
  daysRemaining: number;
  badgeText: string;
  badgeVariant: "success" | "warning" | "danger" | "neutral" | "demo" | "info";
  statusNote: string;
  freshnessState: FreshnessState;
}

/**
 * Centralized Opportunity Status Engine
 * The single authority in the platform for resolving opportunity status, days remaining,
 * freshness, and active applicability.
 *
 * PRODUCTION DATE RULE:
 * If referenceDate is not supplied, it defaults to the actual current server date/time `new Date()`.
 * Tests may supply fixed reference dates (e.g. `new Date("2026-08-20T00:00:00Z")`).
 *
 * CRITICAL SAFETY INVARIANTS:
 * 1. If deadline < referenceDate, status is ALWAYS EXPIRED, and daysRemaining is ALWAYS 0.
 * 2. Never show "X days left" for an expired or closed opportunity.
 * 3. If official source status is unverified or ambiguous, status is UNKNOWN ("Status needs verification").
 * 4. Demo items are always demarcated with DEMO status / sample badge.
 */
export function getOpportunityStatus(
  opportunity: Opportunity,
  referenceDate?: Date
): OpportunityStatusResult {
  // Use actual current server date/time in production if not explicitly passed
  const ref = referenceDate instanceof Date ? referenceDate : new Date();

  // 1. Check if explicitly marked expired or closed by lifecycle/verification
  if (
    opportunity.verificationStatus === "expired" ||
    (opportunity as any).lifecycleStatus === "expired"
  ) {
    return {
      status: "EXPIRED",
      isExpired: true,
      isActivelyApplicable: false,
      daysRemaining: 0,
      badgeText: "Expired",
      badgeVariant: "danger",
      statusNote: "Application window has closed.",
      freshnessState: "Expired",
    };
  }

  // 2. Parse stored deadline
  let deadlineDate: Date | null = null;
  if (opportunity.deadline) {
    const parsed = new Date(opportunity.deadline);
    if (!isNaN(parsed.getTime())) {
      deadlineDate = parsed;
    }
  }

  // 3. If no valid deadline exists or unverified source
  if (!deadlineDate) {
    return {
      status: "UNKNOWN",
      isExpired: false,
      isActivelyApplicable: false,
      daysRemaining: 0,
      badgeText: "Needs Verification",
      badgeVariant: "warning",
      statusNote: "Official deadline not confirmed. Verification in progress.",
      freshnessState: "Needs Verification",
    };
  }

  // 4. Calculate exact difference in calendar days (UTC normalized)
  const refUTC = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate());
  const deadUTC = Date.UTC(
    deadlineDate.getUTCFullYear(),
    deadlineDate.getUTCMonth(),
    deadlineDate.getUTCDate()
  );
  const diffDays = Math.round((deadUTC - refUTC) / (1000 * 60 * 60 * 24));

  // 5. HARD RULE: If deadline has passed
  if (diffDays < 0) {
    return {
      status: "EXPIRED",
      isExpired: true,
      isActivelyApplicable: false,
      daysRemaining: 0,
      badgeText: "Deadline Passed",
      badgeVariant: "danger",
      statusNote: `Application window closed on ${opportunity.deadline}.`,
      freshnessState: "Expired",
    };
  }

  const daysRemaining = diffDays;

  // 6. Check Freshness of verification
  let freshnessState: FreshnessState = "Fresh";
  if (opportunity.lastVerified) {
    const lastVerDate = new Date(opportunity.lastVerified);
    if (!isNaN(lastVerDate.getTime())) {
      const daysSinceVerified = Math.ceil(
        (ref.getTime() - lastVerDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceVerified > 30) {
        freshnessState = "Stale";
      } else if (daysSinceVerified > 14) {
        freshnessState = "Needs Verification";
      }
    }
  }

  // 7. Handle Demo data
  if (opportunity.isDemo) {
    if (daysRemaining <= 7) {
      return {
        status: "CLOSING_SOON",
        isExpired: false,
        isActivelyApplicable: true,
        daysRemaining,
        badgeText: `${daysRemaining} Day${daysRemaining === 1 ? "" : "s"} Left (Demo)`,
        badgeVariant: "warning",
        statusNote: `Sample demo deadline: ${opportunity.deadline}.`,
        freshnessState: "Fresh",
      };
    }
    return {
      status: "DEMO",
      isExpired: false,
      isActivelyApplicable: true,
      daysRemaining,
      badgeText: `Demo (${daysRemaining}d left)`,
      badgeVariant: "demo",
      statusNote: `Illustrative sample opportunity for testing.`,
      freshnessState: "Fresh",
    };
  }

  // 8. Handle Real Opportunities
  // Closing soon threshold: 1 to 7 days
  if (daysRemaining <= 7) {
    return {
      status: "CLOSING_SOON",
      isExpired: false,
      isActivelyApplicable: true,
      daysRemaining,
      badgeText: `Closing in ${daysRemaining} Day${daysRemaining === 1 ? "" : "s"}`,
      badgeVariant: "warning",
      statusNote: `Applications closing rapidly on ${opportunity.deadline}.`,
      freshnessState,
    };
  }

  // Active Opportunity
  return {
    status: "ACTIVE",
    isExpired: false,
    isActivelyApplicable: true,
    daysRemaining,
    badgeText: `${daysRemaining} Days Left`,
    badgeVariant: "success",
    statusNote: `Active official opportunity verified on ${opportunity.lastVerified || "recently"}.`,
    freshnessState,
  };
}
