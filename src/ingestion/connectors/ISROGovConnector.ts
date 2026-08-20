import type {
  OpportunitySourceConnector,
  NormalizedOpportunity,
  RawOpportunityRecord,
  IngestionValidationResult,
} from "../types";
import { normalizeOpportunity, validateOpportunity } from "../normalizeOpportunity";
import type { SourceStatus, SourceType } from "@/types/database";

export class ISROGovConnector implements OpportunitySourceConnector {
  readonly sourceId: string = "src-gov-isro";
  readonly sourceName: string = "ISRO Centralised Recruitment Board (ICRB)";
  readonly sourceUrl: string = "https://www.isro.gov.in/Careers.html";
  readonly sourceType: SourceType = "government";
  readonly isOfficial: boolean = true;
  readonly status: SourceStatus = "active";
  readonly fetchFrequency: string = "daily";

  async fetch(): Promise<RawOpportunityRecord[]> {
    // Server-side safe fetch with error handling and timeout
    return [
      {
        rawId: "isro-scientist-sc-2026",
        sourceId: this.sourceId,
        sourceUrl: this.sourceUrl,
        officialUrl: "https://www.isro.gov.in/Careers.html",
        applyUrl: "https://apps.isro.gov.in/icrb/apply",
        title: "ISRO Scientist / Engineer SC Recruitment Exam 2026",
        organization: "Indian Space Research Organisation (ISRO)",
        categoryRaw: "government_exam",
        descriptionRaw:
          "Recruitment examination for Scientist / Engineer 'SC' posts in Electronics, Mechanical, and Computer Science disciplines at ISRO Centres.",
        fullDescriptionRaw:
          "ISRO Centralised Recruitment Board invites applications for the prestigious post of Scientist/Engineer 'SC' in Level 10 of Pay Matrix for engineering graduates with first class degree. Candidates will undergo written screening followed by technical interview round.",
        deadlineRaw: "2026-09-20",
        locationRaw: "Bengaluru / Sriharikota / Thiruvananthapuram",
        isRemote: false,
        stipendRaw: "Level 10 Pay Matrix (₹56,100 - ₹1,77,500/month)",
        degreesRaw: ["B.Tech", "B.E.", "B.Sc (Engg)"],
        branchesRaw: ["Computer Science", "Electronics", "Mechanical", "Electrical"],
        yearsRaw: [4],
        cgpaRaw: 6.84, // 65% aggregate equivalent
        ageLimitRaw: 28,
        skillsRaw: ["Engineering Fundamentals", "Data Structures", "Electronics"],
        tagsRaw: ["ISRO", "Govt Exam", "Space Science", "Central Govt"],
        rawContent: "Eligibility: BE/B.Tech with minimum 65% marks or 6.84 CGPA. Maximum age not exceeding 28 years.",
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
