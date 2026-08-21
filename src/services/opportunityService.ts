import { Opportunity, EligibilityCriteria, StudentProfile } from "@/types";
import { realVerifiedOpportunities } from "@/data/realOpportunities";
import { getSupabaseClient } from "@/lib/supabase/client";
import { DbOpportunity, DbOpportunityEligibilityRule, DbOpportunitySource } from "@/types/database";
import { reviewQueueService } from "@/ingestion/reviewQueueService";
import { appConfig, assertProductionConfig } from "@/lib/config";
import { getOpportunityStatus } from "@/services/opportunityStatusResolver";
import { matchingService, RankedOpportunityMatch } from "@/services/matchingService";
import { opportunityVerificationService } from "@/services/opportunityVerificationService";

function mapDbToOpportunity(
  dbOpp: DbOpportunity,
  rules?: DbOpportunityEligibilityRule | null
): Opportunity {
  const eligibilityCriteria: EligibilityCriteria = rules
    ? {
        allowedDegrees: rules.allowed_degrees || ["All Degrees"],
        allowedBranches: rules.allowed_branches || ["All Branches"],
        allowedYears: rules.allowed_study_years || [1, 2, 3, 4],
        minCGPA: rules.min_cgpa ? Number(rules.min_cgpa) : undefined,
        maxAge: rules.max_age || undefined,
        minAge: rules.min_age || undefined,
        requiredSkills: rules.required_skills || [],
        eligibleLocations: rules.eligible_locations || ["All India"],
        eligibleGender: (rules.eligible_gender as any) || "all",
        domicileRequired: rules.domicile_required || "All India",
      }
    : {
        allowedDegrees: ["All Degrees"],
        allowedBranches: ["All Branches"],
        allowedYears: [1, 2, 3, 4],
      };

  return {
    id: dbOpp.id,
    sourceId: dbOpp.source_id || undefined,
    sourceName: dbOpp.source_name || "Official Source",
    sourceType: (dbOpp.source_type as any) || "official",
    title: dbOpp.title,
    organization: dbOpp.organization,
    category: dbOpp.category,
    categoryLabel: dbOpp.category_label,
    description: dbOpp.description,
    fullDescription: dbOpp.full_description,
    deadline: dbOpp.deadline.split("T")[0],
    location: dbOpp.location,
    remote: dbOpp.remote,
    stipendOrPrize: dbOpp.stipend_or_prize,
    stipendType: dbOpp.stipend_type,
    officialUrl: dbOpp.official_url,
    applyUrl: dbOpp.apply_url || undefined,
    sourceUrl: dbOpp.source_url || undefined,
    officialSourceUrl: dbOpp.official_source_url || undefined,
    rulesPdfUrl: dbOpp.rules_pdf_url || undefined,
    sourceConflict: dbOpp.source_conflict || false,
    sourceMetadata: dbOpp.source_metadata || undefined,
    verificationStatus: dbOpp.verification_status,
    lifecycleStatus: dbOpp.lifecycle_status,
    lastVerified: dbOpp.last_verified_at ? dbOpp.last_verified_at.split("T")[0] : new Date().toISOString().split("T")[0],
    featured: dbOpp.featured || false,
    tags: dbOpp.tags || [],
    benefits: dbOpp.benefits || [],
    applicationSteps: dbOpp.application_steps || [],
    importantDates: dbOpp.important_dates || [],
    eligibilityCriteria,
  };
}

export interface StudentMatchedOpportunitiesResult {
  activeOpportunities: Opportunity[];
  rankedMatches: RankedOpportunityMatch[];
  topMatches: RankedOpportunityMatch[];
  closingSoonMatches: RankedOpportunityMatch[];
  newForYouMatches: RankedOpportunityMatch[];
  interestMatches: RankedOpportunityMatch[];
  totalActiveEvaluated: number;
  eligibleCount: number;
  potentiallyEligibleCount: number;
  closingSoonCount: number;
}

export const opportunityService = {
  /**
   * Fetches only active, verified, published opportunities.
   * STRICT PRODUCTION DATA PIPELINE GUARANTEES:
   * 1. Supabase is the SINGLE SOURCE OF TRUTH in production. Zero mock/static fallback.
   * 2. Database query filters: verification_status IN ('verified', 'partner_verified'), lifecycle_status='published', is_demo=false, deadline >= today.
   * 3. Service layer verifies official/partner allowlists, explicit non-inferred deadlines, and rules PDF validation via opportunityVerificationService.
   * 4. Timezone-normalized expiry checks ensure past-deadline items are completely excluded.
   */
  async getActiveOpportunities(options?: { referenceDate?: Date }): Promise<Opportunity[]> {
    const refDate = options?.referenceDate instanceof Date ? options.referenceDate : new Date();
    const todayIso = refDate.toISOString().split("T")[0];

    // 1. Production Mode: Strictly query live Supabase database
    if (appConfig.isProduction) {
      assertProductionConfig();
      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("[Production Error] Supabase client is not configured in production mode.");
      }

      try {
        const { data: opps, error } = await supabase
          .from("opportunities")
          .select("*, opportunity_eligibility_rules(*)")
          .in("verification_status", ["verified", "partner_verified", "verified_gov", "verified_partner"])
          .eq("lifecycle_status", "published")
          .eq("is_demo", false)
          .gte("deadline", todayIso)
          .order("deadline", { ascending: true });

        if (error) {
          console.error("Failed to query opportunities from Supabase:", error);
          throw error;
        }

        if (opps) {
          return opps
            .map((o: any) =>
              mapDbToOpportunity(
                o,
                o.opportunity_eligibility_rules?.[0] || o.opportunity_eligibility_rules
              )
            )
            .filter((opp) => {
              // Defensive verification check
              const verifyRes = opportunityVerificationService.verifyOpportunity(opp, refDate);
              const statusRes = getOpportunityStatus(opp, refDate);
              return (
                verifyRes.verified &&
                !verifyRes.isExpired &&
                !statusRes.isExpired &&
                statusRes.status !== "EXPIRED" &&
                statusRes.status !== "UNKNOWN"
              );
            });
        }
        return [];
      } catch (err) {
        console.error("Production Supabase opportunities query failed:", err);
        throw err;
      }
    }

    // 2. Dev / Local Mode: Try Supabase if configured, otherwise fallback to local verified catalog
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: opps, error } = await supabase
          .from("opportunities")
          .select("*, opportunity_eligibility_rules(*)")
          .in("verification_status", ["verified", "partner_verified", "verified_gov", "verified_partner"])
          .eq("lifecycle_status", "published")
          .eq("is_demo", false)
          .gte("deadline", todayIso)
          .order("deadline", { ascending: true });

        if (opps && opps.length > 0 && !error) {
          return opps
            .map((o: any) =>
              mapDbToOpportunity(
                o,
                o.opportunity_eligibility_rules?.[0] || o.opportunity_eligibility_rules
              )
            )
            .filter((opp) => {
              const verifyRes = opportunityVerificationService.verifyOpportunity(opp, refDate);
              const statusRes = getOpportunityStatus(opp, refDate);
              return verifyRes.verified && !verifyRes.isExpired && !statusRes.isExpired;
            });
        }
      } catch (err) {
        console.warn("Supabase active fetch fallback in dev mode:", err);
      }
    }

    // Dev fallback: Filter candidate list strictly through verification service
    const publishedReal = reviewQueueService.getPublishedRealOpportunities();
    const candidateList = publishedReal.length > 0 ? publishedReal : realVerifiedOpportunities;

    return candidateList.filter((opp) => {
      const verifyRes = opportunityVerificationService.verifyOpportunity(opp, refDate);
      const statusRes = getOpportunityStatus(opp, refDate);
      return (
        !opp.isDemo &&
        opp.verificationStatus === "verified" &&
        opp.lifecycleStatus === "published" &&
        verifyRes.verified &&
        !verifyRes.isExpired &&
        !statusRes.isExpired
      );
    });
  },

  /**
   * Main entrypoint for active opportunity list (alias to getActiveOpportunities)
   */
  async getOpportunities(options?: { referenceDate?: Date }): Promise<Opportunity[]> {
    return this.getActiveOpportunities(options);
  },

  /**
   * Evaluates and ranks live active opportunities dynamically for a given student profile.
   */
  async getEligibleOpportunitiesForStudent(
    studentProfile: StudentProfile,
    options?: { referenceDate?: Date }
  ): Promise<StudentMatchedOpportunitiesResult> {
    const activeOpps = await this.getActiveOpportunities(options);

    // Evaluate deterministic match for each active opportunity
    const rawMatches = activeOpps.map((opp) => ({
      opportunity: opp,
      match: matchingService.evaluateMatch(studentProfile.id || "current-student", studentProfile, opp),
    }));

    // Multi-factor ranking
    const rankedMatches = matchingService.rankMatchesForStudent(studentProfile, rawMatches);

    // Filter dynamic streams
    const topMatches = rankedMatches.filter(
      (r) => !r.isExpired && r.match.score >= 80 && r.match.status === "eligible"
    );

    const closingSoonMatches = rankedMatches.filter(
      (r) => !r.isExpired && r.isUrgent && r.match.status !== "not_eligible"
    );

    const interestMatches = rankedMatches.filter(
      (r) => !r.isExpired && r.isInterestMatch && r.match.status !== "not_eligible"
    );

    const newForYouMatches = rankedMatches.filter(
      (r) => !r.isExpired && r.opportunity.featured
    );

    const eligibleCount = rankedMatches.filter((r) => !r.isExpired && r.match.status === "eligible").length;
    const potentiallyEligibleCount = rankedMatches.filter((r) => !r.isExpired && r.match.status === "potentially_eligible").length;

    return {
      activeOpportunities: activeOpps,
      rankedMatches,
      topMatches,
      closingSoonMatches,
      newForYouMatches,
      interestMatches,
      totalActiveEvaluated: activeOpps.length,
      eligibleCount,
      potentiallyEligibleCount,
      closingSoonCount: closingSoonMatches.length,
    };
  },

  /**
   * Fetches a single opportunity by ID (verifying against Supabase or queue)
   */
  async getOpportunityById(id: string): Promise<Opportunity | null> {
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { data: opp, error } = await supabase
          .from("opportunities")
          .select("*, opportunity_eligibility_rules(*)")
          .eq("id", id)
          .single();

        if (opp && !error) {
          return mapDbToOpportunity(
            opp,
            opp.opportunity_eligibility_rules?.[0] || opp.opportunity_eligibility_rules
          );
        }
      } catch (err) {
        console.warn("Supabase single opportunity fetch failed:", err);
      }
    }

    const publishedReal = reviewQueueService.getPublishedRealOpportunities();
    const fromQueue = publishedReal.find((o) => o.id === id);
    if (fromQueue) return fromQueue;

    const fromReal = realVerifiedOpportunities.find((o) => o.id === id);
    if (fromReal) return fromReal;

    return null;
  },

  /**
   * Fetches verified sources from Supabase
   */
  async getOpportunitySources(): Promise<DbOpportunitySource[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data } = await supabase.from("opportunity_sources").select("*");
        if (data) return data;
      } catch (e) {
        console.warn("Failed to fetch sources:", e);
      }
    }
    return [];
  },
};


