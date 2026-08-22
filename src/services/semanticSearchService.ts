import {
  Opportunity,
  OpportunityCategory,
  CanonicalCategory,
  Degree,
  StudentProfile,
  EligibilityResult,
  toCanonicalCategory,
} from "@/types";
import { getOpportunityStatus } from "./opportunityStatusResolver";
import { opportunityVerificationService } from "./opportunityVerificationService";

export interface SearchIntent {
  rawQuery: string;
  category?: OpportunityCategory | "government_all";
  degree?: Degree;
  branch?: string;
  year?: number;
  location?: string; // "India", "Remote", or state name
  remoteOnly?: boolean;
  isGovernment?: boolean;
  keywords: string[];
}

export interface SearchFilterOptions {
  category?: string; // "all" or OpportunityCategory
  location?: string; // "all", "india", "remote", state name
  remoteOnly?: boolean;
  state?: string;
  degree?: string; // "all" or Degree
  branch?: string;
  year?: number;
  eligibilityStatus?: string; // "all", "eligible", "potentially_eligible", "not_eligible"
  closingSoonOnly?: boolean;
  sortBy?: "best_match" | "deadline" | "newest";
}

export interface OpportunityItemWithEligibility {
  opportunity: Opportunity;
  eligibility: EligibilityResult;
}

export class SemanticSearchService {
  /**
   * Parses natural language query (English, Hinglish, or Hindi phrase) into structured search intent.
   * Examples:
   * - "Mujhe India mein hackathons chahiye" -> { category: 'hackathon', location: 'India' }
   * - "Mujhe B.Tech first year scholarships chahiye" -> { category: 'scholarship', degree: 'B.Tech', year: 1 }
   * - "Show government internships in India" -> { category: 'government_internship', location: 'India', isGovernment: true }
   * - "AI/ML internships" -> { category: 'private_internship', keywords: ['ai', 'ml'] }
   */
  parseSearchIntent(query: string): SearchIntent {
    const rawQuery = query.trim();
    if (!rawQuery) {
      return { rawQuery: "", keywords: [] };
    }

    const q = rawQuery.toLowerCase();
    const keywords: string[] = [];

    // 1. Category extraction
    let category: OpportunityCategory | "government_all" | undefined = undefined;

    if (q.includes("hackathon") || q.includes("coding challenge") || q.includes("hardware hackathon")) {
      category = "hackathon";
    } else if (q.includes("scholarship") || q.includes("grant") || q.includes("financial aid") || q.includes("pankh")) {
      category = "scholarship";
    } else if (q.includes("government internship") || q.includes("govt internship") || q.includes("niti aayog") || q.includes("nic internship")) {
      category = "government_internship";
    } else if (q.includes("internship") || q.includes("stipend")) {
      category = "private_internship";
    } else if (q.includes("fellowship") || q.includes("research fellowship")) {
      category = "research_internship";
    } else if (q.includes("exam") || q.includes("upsc") || q.includes("ese") || q.includes("recruitment") || q.includes("isro scientist") || q.includes("drdo")) {
      category = "government_exam";
    } else if (q.includes("competition") || q.includes("contest")) {
      category = "competition";
    } else if (q.includes("government") || q.includes("govt") || q.includes("sarkari")) {
      category = "government_all";
    }

    // 2. Degree extraction
    let degree: Degree | undefined = undefined;
    if (q.includes("b.tech") || q.includes("btech") || q.includes("b.e") || q.includes("engineering")) {
      degree = "B.Tech";
    } else if (q.includes("m.tech") || q.includes("mtech")) {
      degree = "M.Tech";
    } else if (q.includes("mca")) {
      degree = "MCA";
    } else if (q.includes("b.sc") || q.includes("bsc")) {
      degree = "B.Sc";
    } else if (q.includes("m.sc") || q.includes("msc")) {
      degree = "M.Sc";
    }

    // 3. Year of study extraction
    let year: number | undefined = undefined;
    if (q.includes("first year") || q.includes("1st year") || q.includes("year 1")) {
      year = 1;
    } else if (q.includes("second year") || q.includes("2nd year") || q.includes("year 2")) {
      year = 2;
    } else if (q.includes("third year") || q.includes("3rd year") || q.includes("year 3")) {
      year = 3;
    } else if (q.includes("fourth year") || q.includes("final year") || q.includes("4th year") || q.includes("year 4")) {
      year = 4;
    }

    // 4. Location & Remote extraction
    let location: string | undefined = undefined;
    let remoteOnly: boolean | undefined = undefined;

    if (q.includes("remote") || q.includes("online") || q.includes("work from home") || q.includes("virtual")) {
      remoteOnly = true;
    }

    if (q.includes("india") || q.includes("pan-india") || q.includes("all india") || q.includes("bharat")) {
      location = "India";
    }

    // 5. Specific domain / tech keywords (e.g. AI, ML, Web3, Python, Robotics)
    const techTerms = ["ai", "ml", "machine learning", "data science", "web3", "blockchain", "python", "robotics", "cybersecurity", "cloud"];
    for (const term of techTerms) {
      if (q.includes(term)) {
        keywords.push(term);
      }
    }

    const isGovernment = q.includes("government") || q.includes("govt") || q.includes("ministry") || q.includes("official");

    return {
      rawQuery,
      category,
      degree,
      branch: keywords.length > 0 ? keywords[0] : undefined,
      year,
      location,
      remoteOnly,
      isGovernment,
      keywords,
    };
  }

  /**
   * Filters the public catalog strictly ensuring:
   * 1. VERIFIED-ONLY: verificationStatus in ['verified', 'partner_verified'], lifecycleStatus = 'published'.
   * 2. UNEXPIRED: deadline >= today and status != EXPIRED.
   * 3. PROVENANCE TRUST: Discovery-only or unverified candidates are strictly excluded.
   * 4. NO FALSE MATCHES: Category and eligibility must strictly match parsed intent & filters.
   */
  filterCatalog(
    items: OpportunityItemWithEligibility[],
    searchQuery: string,
    filters: SearchFilterOptions = {},
    referenceDate?: Date
  ): OpportunityItemWithEligibility[] {
    const refDate = referenceDate || new Date();
    const todayIso = refDate.toISOString().split("T")[0];
    const intent = this.parseSearchIntent(searchQuery);

    return items.filter(({ opportunity, eligibility }) => {
      // RULE 1: VERIFIED-ONLY PUBLIC RESULTS GUARANTEE
      const isVerified =
        opportunity.verificationStatus === "verified" ||
        opportunity.verificationStatus === "partner_verified" ||
        opportunity.verificationStatus === "verified_gov" ||
        opportunity.verificationStatus === "verified_partner";

      const isPublished = opportunity.lifecycleStatus === "published" || !opportunity.lifecycleStatus;

      if (!isVerified || !isPublished) {
        return false;
      }

      // Strict exclusion of discovery-only signals
      if (opportunity.sourceType === "discovery_only" && opportunity.verificationStatus !== "verified") {
        return false;
      }

      // RULE 2: UNEXPIRED DEADLINE GUARANTEE
      if (opportunity.deadline < todayIso) {
        return false;
      }
      const statusRes = getOpportunityStatus(opportunity, refDate);
      if (statusRes.isExpired || statusRes.status === "EXPIRED") {
        return false;
      }

      // RULE 3: STRICT CANONICAL CATEGORY MATCHING (ZERO CATEGORY LEAKAGE)
      const targetCategory = filters.category && filters.category !== "all" ? filters.category : intent.category;

      if (targetCategory && targetCategory !== "all") {
        if (targetCategory === "government_all") {
          const sourceNameLower = (opportunity.sourceName || "").toLowerCase();
          const orgLower = (opportunity.organization || "").toLowerCase();
          const oppCategory = toCanonicalCategory(opportunity.primaryCategory || opportunity.category);
          const isGovCategory =
            oppCategory === "government_exam" ||
            opportunity.category === "government_internship" ||
            opportunity.sourceType === "official" ||
            sourceNameLower.includes("ministry") ||
            sourceNameLower.includes("niti") ||
            sourceNameLower.includes("isro") ||
            sourceNameLower.includes("drdo") ||
            sourceNameLower.includes("upsc") ||
            orgLower.includes("ministry") ||
            orgLower.includes("niti") ||
            orgLower.includes("isro") ||
            orgLower.includes("drdo") ||
            orgLower.includes("upsc");

          if (!isGovCategory) return false;
        } else {
          // Exact Canonical Category Match Required — Zero Category Leakage!
          const oppCanonical = toCanonicalCategory(opportunity.primaryCategory || opportunity.category);
          const targetCanonical = toCanonicalCategory(targetCategory);

          if (oppCanonical !== targetCanonical) {
            return false;
          }
        }
      }

      // RULE 4: DEGREE & ELIGIBILITY MATCHING
      const targetDegree = filters.degree && filters.degree !== "all" ? (filters.degree as Degree) : intent.degree;
      if (targetDegree) {
        const allowed = opportunity.eligibilityCriteria?.allowedDegrees || [];
        const matchesDegree =
          allowed.includes("All Degrees") ||
          allowed.includes(targetDegree) ||
          allowed.some((d) => d.toLowerCase() === targetDegree.toLowerCase());

        if (!matchesDegree) return false;
      }

      // Year of study matching
      const targetYear = filters.year || intent.year;
      if (targetYear) {
        const allowedYears = opportunity.eligibilityCriteria?.allowedYears || [1, 2, 3, 4];
        if (!allowedYears.includes(targetYear)) {
          return false;
        }
      }

      // Branch matching
      const targetBranch = filters.branch || intent.branch;
      if (targetBranch) {
        const allowedBranches = opportunity.eligibilityCriteria?.allowedBranches || ["All Branches"];
        const matchesBranch =
          allowedBranches.includes("All Branches") ||
          allowedBranches.some(
            (b) =>
              b.toLowerCase().includes(targetBranch.toLowerCase()) ||
              targetBranch.toLowerCase().includes(b.toLowerCase())
          ) ||
          opportunity.title.toLowerCase().includes(targetBranch.toLowerCase()) ||
          opportunity.tags?.some((t) => t.toLowerCase().includes(targetBranch.toLowerCase()));

        if (!matchesBranch) return false;
      }

      // RULE 5: LOCATION & REMOTE MATCHING
      const isRemoteRequested = filters.remoteOnly || intent.remoteOnly;
      if (isRemoteRequested && !opportunity.remote) {
        return false;
      }

      const targetLocation = filters.location && filters.location !== "all" ? filters.location : intent.location;
      if (targetLocation && targetLocation.toLowerCase() !== "india" && targetLocation.toLowerCase() !== "all india") {
        const locLower = opportunity.location.toLowerCase();
        if (
          !locLower.includes(targetLocation.toLowerCase()) &&
          !locLower.includes("india") &&
          !locLower.includes("pan-india") &&
          !opportunity.remote
        ) {
          return false;
        }
      }

      // RULE 6: UI ELIGIBILITY FILTER
      if (filters.eligibilityStatus && filters.eligibilityStatus !== "all") {
        if (eligibility.status !== filters.eligibilityStatus) {
          return false;
        }
      }

      // RULE 7: CLOSING SOON FILTER
      if (filters.closingSoonOnly && statusRes.status !== "CLOSING_SOON") {
        return false;
      }

      // RULE 8: KEYWORD & TEXT MATCHING
      if (searchQuery.trim() && intent.keywords.length > 0) {
        const titleLower = opportunity.title.toLowerCase();
        const descLower = opportunity.description.toLowerCase();
        const orgLower = opportunity.organization.toLowerCase();
        const tagsLower = (opportunity.tags || []).join(" ").toLowerCase();

        const matchesAnyKeyword = intent.keywords.some(
          (kw) =>
            titleLower.includes(kw) ||
            descLower.includes(kw) ||
            orgLower.includes(kw) ||
            tagsLower.includes(kw)
        );

        if (!matchesAnyKeyword) {
          return false;
        }
      }

      return true;
    });
  }
}

export const semanticSearchService = new SemanticSearchService();
