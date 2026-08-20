import type { ConfidenceBreakdown, ConfidenceLevel } from "@/types";
import type { RawOpportunityRecord, NormalizedOpportunity } from "./types";
import { parseDeadline } from "./normalizeOpportunity";

/**
 * Evaluates field-level extraction quality and produces a comprehensive
 * ConfidenceBreakdown with overall score and categorization.
 */
export function scoreOpportunityConfidence(
  raw: RawOpportunityRecord,
  opp: NormalizedOpportunity,
  isOfficialSource: boolean
): ConfidenceBreakdown {
  // 1. Title Confidence (0.0 to 1.0)
  let titleScore = 0.5;
  if (opp.title && opp.title.length >= 10 && opp.title !== "Untitled Opportunity") {
    titleScore += 0.3;
    if (!/\[(urgent|new|hiring)\]/i.test(opp.title)) {
      titleScore += 0.2;
    }
  }

  // 2. Deadline Confidence (0.0 to 1.0)
  let deadlineScore = 0.4;
  if (opp.deadline && parseDeadline(opp.deadline)) {
    deadlineScore += 0.3;
    const deadlineDate = new Date(opp.deadline);
    const now = new Date();
    // If deadline is valid future date
    if (deadlineDate.getTime() > now.getTime()) {
      deadlineScore += 0.3;
    }
  }

  // 3. Organization Confidence (0.0 to 1.0)
  let orgScore = 0.5;
  if (opp.organization && opp.organization.length >= 3 && opp.organization !== "Verified Organization") {
    orgScore += 0.3;
    if (isOfficialSource) {
      orgScore += 0.2;
    }
  }

  // 4. URL Confidence (0.0 to 1.0)
  let urlScore = 0.5;
  if (opp.officialUrl && opp.officialUrl.startsWith("https://")) {
    urlScore += 0.3;
    if (opp.applyUrl && opp.applyUrl.startsWith("https://")) {
      urlScore += 0.2;
    }
  }

  // 5. Eligibility Confidence (0.0 to 1.0)
  let eligScore = 0.6;
  const crit = opp.eligibilityCriteria;
  if (crit.allowedDegrees.length > 0 && !crit.allowedDegrees.includes("All Degrees")) {
    eligScore += 0.15;
  }
  if (crit.allowedBranches.length > 0 && !crit.allowedBranches.includes("All Branches")) {
    eligScore += 0.15;
  }
  if (crit.minCGPA || crit.maxAge) {
    eligScore += 0.1;
  }

  // Cap field scores
  const title = Math.min(1.0, Math.max(0.1, Number(titleScore.toFixed(2))));
  const deadline = Math.min(1.0, Math.max(0.1, Number(deadlineScore.toFixed(2))));
  const organization = Math.min(1.0, Math.max(0.1, Number(orgScore.toFixed(2))));
  const url = Math.min(1.0, Math.max(0.1, Number(urlScore.toFixed(2))));
  const eligibility = Math.min(1.0, Math.max(0.1, Number(eligScore.toFixed(2))));

  // Weighted overall calculation:
  // Title (25%) + Deadline (25%) + Org (20%) + URL (15%) + Eligibility (15%)
  const overall = Number(
    (title * 0.25 + deadline * 0.25 + organization * 0.2 + url * 0.15 + eligibility * 0.15).toFixed(2)
  );

  let level: ConfidenceLevel = "needs_review";
  if (overall >= 0.85) {
    level = "high_confidence";
  } else if (overall >= 0.6) {
    level = "review_recommended";
  } else {
    level = "needs_review";
  }

  return {
    title,
    deadline,
    organization,
    url,
    eligibility,
    overall,
    level,
  };
}
