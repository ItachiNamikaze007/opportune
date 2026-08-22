import type { Opportunity, ConfidenceLevel } from "@/types";

export interface ConfidenceBreakdownResult {
  officialDomainVerifiedScore: number; // max 40
  officialSourceMatchScore: number;    // max 25
  validDeadlineScore: number;          // max 15
  eligibilityCompletenessScore: number;// max 10
  linkHealthScore: number;             // max 10
  totalScore: number;                  // 0 - 100
  confidenceLevel: ConfidenceLevel;
}

export class ConfidenceScoringService {
  /**
   * Deterministic, documented confidence scoring algorithm.
   * Total Score (0-100%) =
   *   +40% Official Domain HTTP Verified
   *   +25% Match with Official Organizer Website Domain
   *   +15% Valid Extracted & Unexpired Deadline
   *   +10% Explicit Eligibility Criteria Specified
   *   +10% Link Health Verified (No 404/Redirect loop)
   */
  calculateConfidence(params: {
    officialUrl: string;
    isDomainVerified: boolean;
    isOfficialSource: boolean;
    deadline?: string;
    hasEligibility: boolean;
    isLinkHealthy: boolean;
  }): ConfidenceBreakdownResult {
    let domainScore = 0;
    let sourceMatchScore = 0;
    let deadlineScore = 0;
    let eligibilityScore = 0;
    let linkHealthScore = 0;

    // 1. Domain Verification (+40%)
    if (params.isDomainVerified) {
      domainScore = 40;
    }

    // 2. Source Provenance Match (+25%)
    if (params.isOfficialSource) {
      sourceMatchScore = 25;
    } else {
      sourceMatchScore = 15; // Recognized partner source
    }

    // 3. Deadline Validity (+15%)
    if (params.deadline) {
      const todayIso = new Date().toISOString().split("T")[0];
      if (params.deadline >= todayIso) {
        deadlineScore = 15;
      }
    }

    // 4. Eligibility Completeness (+10%)
    if (params.hasEligibility) {
      eligibilityScore = 10;
    }

    // 5. Link Health (+10%)
    if (params.isLinkHealthy) {
      linkHealthScore = 10;
    }

    const totalScore = domainScore + sourceMatchScore + deadlineScore + eligibilityScore + linkHealthScore;

    let confidenceLevel: ConfidenceLevel = "needs_review";
    if (totalScore >= 85) {
      confidenceLevel = "high_confidence";
    } else if (totalScore >= 70) {
      confidenceLevel = "review_recommended";
    }

    return {
      officialDomainVerifiedScore: domainScore,
      officialSourceMatchScore: sourceMatchScore,
      validDeadlineScore: deadlineScore,
      eligibilityCompletenessScore: eligibilityScore,
      linkHealthScore,
      totalScore,
      confidenceLevel,
    };
  }
}

export const confidenceScoringService = new ConfidenceScoringService();
