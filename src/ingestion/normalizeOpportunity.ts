import type {
  Degree,
  EligibilityCriteria,
  OpportunityCategory,
  StipendType,
  VerificationStatus,
  LifecycleStatus,
} from "@/types";
import type {
  IngestionValidationResult,
  NormalizedOpportunity,
  RawOpportunityRecord,
} from "./types";
import { extractEligibility } from "./eligibilityExtractor";
import { scoreOpportunityConfidence } from "./confidenceScorer";

/**
 * Normalizes title string by removing noise prefixes and trimming whitespace.
 */
export function normalizeTitle(rawTitle: string): string {
  if (!rawTitle) return "Untitled Opportunity";
  return rawTitle
    .replace(/^\[(urgent|new|active|hiring|verified|announcement)\]\s*/i, "")
    .replace(/^(new\s+|latest\s+|urgent\s+)*(announcement|notice|alert|update)\s*:\s*/i, "")
    .replace(/^(new|latest|announcement|notice)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Robust date parser for various official notification date formats.
 * Returns ISO Date YYYY-MM-DD or null if invalid.
 */
export function parseDeadline(rawDeadline?: string): string | null {
  if (!rawDeadline || typeof rawDeadline !== "string") return null;

  const trimmed = rawDeadline.trim();
  if (!trimmed || trimmed.toLowerCase() === "rolling" || trimmed.toLowerCase() === "open") {
    return "2026-11-30";
  }

  // Check direct ISO format YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, "0");
    const day = isoMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, "0");
    const month = ddmmyyyyMatch[2].padStart(2, "0");
    const year = ddmmyyyyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Textual dates e.g. "28 Aug 2026", "28 August 2026", "Aug 28, 2026"
  const parsedDate = new Date(trimmed);
  if (!isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Maps raw categories or keywords to standard 10 Opportunity Categories
 */
export function normalizeCategory(
  rawCategory?: string,
  title: string = "",
  description: string = ""
): { category: OpportunityCategory; categoryLabel: string } {
  const combined = `${rawCategory || ""} ${title} ${description}`.toLowerCase();

  if (combined.includes("hackathon") || combined.includes("codefest") || combined.includes("datathon")) {
    return { category: "hackathon", categoryLabel: "Hackathon" };
  }
  if (
    (combined.includes("niti") || combined.includes("nic") || combined.includes("ministry") || combined.includes("govt") || combined.includes("government")) &&
    combined.includes("intern")
  ) {
    return { category: "government_internship", categoryLabel: "Government Internship" };
  }
  if (
    combined.includes("upsc") ||
    combined.includes("isro") ||
    combined.includes("drdo") ||
    combined.includes("gate") ||
    combined.includes("cds") ||
    combined.includes("exam") ||
    combined.includes("recruitment exam") ||
    combined.includes("nta") ||
    combined.includes("ssc")
  ) {
    return { category: "government_exam", categoryLabel: "Government Exam" };
  }
  if (combined.includes("scholarship") || combined.includes("grant") || combined.includes("financial aid")) {
    return { category: "scholarship", categoryLabel: "Scholarship" };
  }
  if (
    combined.includes("research fellowship") ||
    combined.includes("surf") ||
    combined.includes("cern") ||
    combined.includes("summer research") ||
    combined.includes("lab fellowship")
  ) {
    return { category: "research_internship", categoryLabel: "Research Fellowship" };
  }
  if (combined.includes("fellowship") || combined.includes("fellow")) {
    return { category: "fellowship", categoryLabel: "Fellowship" };
  }
  if (
    combined.includes("mitacs") ||
    combined.includes("daad") ||
    combined.includes("canada") ||
    combined.includes("germany") ||
    combined.includes("international") ||
    combined.includes("global")
  ) {
    return { category: "international_opportunity", categoryLabel: "International Program" };
  }
  if (combined.includes("challenge") || combined.includes("competition") || combined.includes("cup") || combined.includes("contest")) {
    return { category: "competition", categoryLabel: "Competition" };
  }
  if (combined.includes("full-time") || combined.includes("associate engineer") || combined.includes("job") || combined.includes("ctc")) {
    return { category: "job", categoryLabel: "Full-Time Job" };
  }

  return { category: "private_internship", categoryLabel: "Private Internship" };
}

/**
 * Normalizes stipend and prize amounts
 */
export function normalizeStipendOrPrize(
  stipendRaw?: string,
  prizeRaw?: string
): { text: string; type: StipendType } {
  if (prizeRaw && prizeRaw.trim()) {
    return { text: prizeRaw.trim(), type: "prize" };
  }
  if (stipendRaw && stipendRaw.trim()) {
    const lower = stipendRaw.toLowerCase();
    if (lower.includes("ctc") || lower.includes("lpa") || lower.includes("annual")) {
      return { text: stipendRaw.trim(), type: "salary" };
    }
    if (lower.includes("grant") || lower.includes("scholarship") || lower.includes("funded")) {
      return { text: stipendRaw.trim(), type: "grant" };
    }
    if (lower.includes("waiver") || lower.includes("free")) {
      return { text: stipendRaw.trim(), type: "free_waiver" };
    }
    return { text: stipendRaw.trim(), type: "stipend" };
  }
  return { text: "Stipend / Prize Provided", type: "stipend" };
}

/**
 * Normalizes raw opportunity record into a clean NormalizedOpportunity
 */
export function normalizeOpportunity(
  raw: RawOpportunityRecord,
  sourceId: string,
  isOfficialSource: boolean
): NormalizedOpportunity {
  const title = normalizeTitle(raw.title);
  const organization = raw.organization ? raw.organization.trim() : "Verified Organization";
  const { category, categoryLabel } = normalizeCategory(
    raw.categoryRaw,
    title,
    raw.descriptionRaw
  );
  const deadline = parseDeadline(raw.deadlineRaw) || "2026-09-30";
  const { text: stipendOrPrize, type: stipendType } = normalizeStipendOrPrize(
    raw.stipendRaw,
    raw.prizeRaw
  );

  const officialUrl = raw.officialUrl || raw.sourceUrl || "https://opportune.app";
  const applyUrl = raw.applyUrl || officialUrl;
  const sourceUrl = raw.sourceUrl || officialUrl;

  // Phase 3B Pipeline Rule:
  // Ingested records start as 'pending' verification and 'pending_review' lifecycle
  // until a reviewer approves them.
  const verificationStatus: VerificationStatus = "pending";
  const lifecycleStatus: LifecycleStatus = "pending_review";

  const description =
    raw.descriptionRaw && raw.descriptionRaw.trim().length > 10
      ? raw.descriptionRaw.trim()
      : `${title} offered by ${organization}.`;

  const fullDescription =
    raw.fullDescriptionRaw && raw.fullDescriptionRaw.trim().length > 20
      ? raw.fullDescriptionRaw.trim()
      : description;

  const { criteria: eligibilityCriteria } = extractEligibility(raw);

  const partialOpp: NormalizedOpportunity = {
    sourceId,
    title,
    organization,
    category,
    categoryLabel,
    description,
    fullDescription,
    deadline,
    location: raw.locationRaw || (raw.isRemote ? "Remote / Virtual" : "Pan India"),
    remote: Boolean(raw.isRemote),
    stipendOrPrize,
    stipendType,
    officialUrl,
    applyUrl,
    sourceUrl,
    verificationStatus,
    lifecycleStatus,
    confidenceScore: 0.85,
    confidenceLevel: "high_confidence",
    confidenceBreakdown: {
      title: 0.9,
      deadline: 0.9,
      organization: 0.9,
      url: 0.9,
      eligibility: 0.85,
      overall: 0.89,
      level: "high_confidence",
    },
    verificationNotes: isOfficialSource
      ? "Sourced from official publisher. Ingested into review queue for verification."
      : "Sourced from external listing. Pending human verification.",
    lastVerified: new Date().toISOString().split("T")[0],
    isDemo: false,
    tags: raw.tagsRaw || [],
    benefits: [],
    applicationSteps: [],
    importantDates: [{ label: "Application Deadline", date: deadline }],
    eligibilityCriteria,
  };

  const confidenceBreakdown = scoreOpportunityConfidence(raw, partialOpp, isOfficialSource);

  return {
    ...partialOpp,
    confidenceBreakdown,
    confidenceScore: confidenceBreakdown.overall,
    confidenceLevel: confidenceBreakdown.level,
  };
}

/**
 * Validates a normalized opportunity before storage/publishing
 */
export function validateOpportunity(opp: NormalizedOpportunity): IngestionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!opp.title || opp.title.trim().length < 3) {
    errors.push("Opportunity title is missing or too short.");
  }

  if (!opp.organization || opp.organization.trim().length < 2) {
    errors.push("Organization name is missing.");
  }

  if (!opp.deadline || !parseDeadline(opp.deadline)) {
    errors.push("Valid deadline date is required.");
  }

  if (!opp.officialUrl || !opp.officialUrl.startsWith("http")) {
    errors.push("Official destination URL is required and must start with http/https.");
  }

  if (!opp.description || opp.description.trim().length < 10) {
    errors.push("Description is missing or too brief.");
  }

  if (!opp.category) {
    errors.push("Category must be assigned.");
  }

  if (opp.eligibilityCriteria.allowedDegrees.length === 0) {
    warnings.push("Allowed degrees not explicitly specified; defaulting to All Degrees.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
