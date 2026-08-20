import type {
  OpportunitySourceConnector,
  NormalizedOpportunity,
  RawOpportunityRecord,
  IngestionValidationResult,
} from "../types";
import { normalizeOpportunity, validateOpportunity } from "../normalizeOpportunity";
import type { SourceStatus, SourceType } from "@/types/database";

/**
 * UPSC Official Exam Portal Connector
 * Demonstrates safe handling for sources requiring manual document verification
 * (marked as manual_review_required so automatic ingestion does not scrape blindly).
 */
export class UPSCExamConnector implements OpportunitySourceConnector {
  readonly sourceId: string = "src-gov-upsc";
  readonly sourceName: string = "Union Public Service Commission (UPSC)";
  readonly sourceUrl: string = "https://upsc.gov.in/examinations/active-exams";
  readonly sourceType: SourceType = "government";
  readonly isOfficial: boolean = true;
  readonly status: SourceStatus = "manual_review_required";
  readonly fetchFrequency: string = "weekly";

  async fetch(): Promise<RawOpportunityRecord[]> {
    // Requires manual verification of official gazette notification PDF
    return [
      {
        rawId: "upsc-ese-2026",
        sourceId: this.sourceId,
        sourceUrl: this.sourceUrl,
        officialUrl: "https://upsc.gov.in",
        applyUrl: "https://upsconline.nic.in",
        title: "Engineering Services Examination (ESE) 2026",
        organization: "Union Public Service Commission (UPSC)",
        categoryRaw: "government_exam",
        descriptionRaw:
          "Combined competitive examination for recruitment to Indian Railway Management Service, Central Power Engineering Service, and Indian Telecommunication Service.",
        deadlineRaw: "2026-10-15",
        locationRaw: "All India Examination Centres",
        isRemote: false,
        stipendRaw: "Group 'A' Central Gazette Services Pay Level 10",
        degreesRaw: ["B.Tech", "B.E."],
        branchesRaw: ["Civil", "Mechanical", "Electrical", "Electronics"],
        yearsRaw: [4],
        ageLimitRaw: 30,
        skillsRaw: ["Core Engineering", "General Studies"],
        tagsRaw: ["UPSC", "ESE", "Govt Exam", "Gazetted Post"],
        rawContent: "A candidate must have obtained a degree in Engineering from a recognized university. Age between 21 and 30 years.",
      },
    ];
  }

  normalize(raw: RawOpportunityRecord): NormalizedOpportunity {
    return normalizeOpportunity(raw, this.sourceId, this.isOfficial);
  }

  validate(item: NormalizedOpportunity): IngestionValidationResult {
    return validateOpportunity(item);
  }
}
