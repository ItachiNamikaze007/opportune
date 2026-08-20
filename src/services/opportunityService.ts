import { Opportunity, EligibilityCriteria } from "@/types";
import { realVerifiedOpportunities } from "@/data/realOpportunities";
import { getSupabaseClient } from "@/lib/supabase/client";
import { DbOpportunity, DbOpportunityEligibilityRule, DbOpportunitySource } from "@/types/database";
import { reviewQueueService } from "@/ingestion/reviewQueueService";
import { appConfig, assertProductionConfig } from "@/lib/config";

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
    verificationStatus: dbOpp.verification_status,
    lastVerified: dbOpp.last_verified_at.split("T")[0],
    featured: dbOpp.featured,
    tags: dbOpp.tags || [],
    benefits: dbOpp.benefits || [],
    applicationSteps: dbOpp.application_steps || [],
    importantDates: dbOpp.important_dates || [],
    eligibilityCriteria,
  };
}

export const opportunityService = {
  /**
   * Fetches all real opportunities from Supabase with rules, or returns verified published catalog.
   * STRICT ISOLATION RULE: User-facing feeds only receive is_demo = false, verified, published opportunities.
   */
  async getOpportunities(): Promise<Opportunity[]> {
    if (appConfig.isProduction) {
      assertProductionConfig();
      const supabase = getSupabaseClient();

      if (supabase) {
        try {
          const { data: opps, error } = await supabase
            .from("opportunities")
            .select("*, opportunity_eligibility_rules(*)")
            .eq("lifecycle_status", "published")
            .order("deadline", { ascending: true });

          if (opps && !error) {
            const dbList = opps.map((o: any) =>
              mapDbToOpportunity(
                o,
                o.opportunity_eligibility_rules?.[0] || o.opportunity_eligibility_rules
              )
            );
            const publishedReal = reviewQueueService.getPublishedRealOpportunities();
            const combined = [...dbList];
            for (const pub of publishedReal) {
              if (!combined.some((c) => c.id === pub.id)) {
                combined.push(pub);
              }
            }
            return combined.filter((o) => !o.isDemo && o.verificationStatus === "verified");
          }
        } catch (err) {
          console.error("Production Supabase opportunities query failed:", err);
          throw err;
        }
      }

      // In production mode, only return verified published real opportunities from ingestion pipeline
      return reviewQueueService.getPublishedRealOpportunities().filter((o) => !o.isDemo);
    }

    // Default application mode: Supabase or verified published real opportunities
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: opps, error } = await supabase
          .from("opportunities")
          .select("*, opportunity_eligibility_rules(*)")
          .eq("lifecycle_status", "published")
          .order("deadline", { ascending: true });

        if (opps && opps.length > 0 && !error) {
          return opps.map((o: any) =>
            mapDbToOpportunity(
              o,
              o.opportunity_eligibility_rules?.[0] || o.opportunity_eligibility_rules
            )
          ).filter((o) => !o.isDemo && o.verificationStatus === "verified");
        }
      } catch (err) {
        console.warn("Supabase real fetch fallback:", err);
      }
    }

    const publishedReal = reviewQueueService.getPublishedRealOpportunities();
    if (publishedReal.length > 0) {
      return publishedReal.filter((o) => !o.isDemo && o.verificationStatus === "verified");
    }

    return realVerifiedOpportunities.filter(
      (o) => !o.isDemo && o.verificationStatus === "verified" && o.lifecycleStatus === "published"
    );
  },

  /**
   * Fetches a single opportunity by ID
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
   * Fetches verified sources
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
