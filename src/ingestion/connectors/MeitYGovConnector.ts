import type {
  OpportunitySourceConnector,
  NormalizedOpportunity,
  RawOpportunityRecord,
  IngestionValidationResult,
} from "../types";
import { normalizeOpportunity, validateOpportunity } from "../normalizeOpportunity";
import type { SourceStatus, SourceType } from "@/types/database";

export class MeitYGovConnector implements OpportunitySourceConnector {
  readonly sourceId: string = "src-gov-meity";
  readonly sourceName: string = "Ministry of Electronics & IT (MeitY) - Digital India";
  readonly sourceUrl: string = "https://www.meity.gov.in/schemes";
  readonly sourceType: SourceType = "government";
  readonly isOfficial: boolean = true;
  readonly status: SourceStatus = "active";
  readonly fetchFrequency: string = "daily";

  async fetch(): Promise<RawOpportunityRecord[]> {
    return [
      {
        rawId: "meity-digital-india-2026",
        sourceId: this.sourceId,
        sourceUrl: this.sourceUrl,
        officialUrl: "https://www.meity.gov.in/internship-scheme",
        applyUrl: "https://meity.gov.in/schemes/apply",
        title: "Digital India AI & Quantum Tech Fellowship 2026",
        organization: "Ministry of Electronics & Information Technology (MeitY)",
        categoryRaw: "government_internship",
        descriptionRaw:
          "High-impact internship in next-generation sovereign AI, quantum computing algorithms, and Indian semiconductor mission.",
        fullDescriptionRaw:
          "MeitY Digital India Fellowship offers undergraduate and postgraduate scholars an immersive research experience under distinguished chief scientists working on IndiaAI compute stack and semiconductor initiatives.",
        deadlineRaw: "2026-09-15",
        locationRaw: "New Delhi (Electronics Niketan) / Hybrid",
        isRemote: false,
        stipendRaw: "₹25,000/month Stipend + Certificate",
        degreesRaw: ["B.Tech", "M.Tech", "MCA", "M.Sc", "PhD"],
        branchesRaw: ["Computer Science", "IT", "Data Science", "Electronics", "Artificial Intelligence"],
        yearsRaw: [3, 4],
        cgpaRaw: 7.5,
        skillsRaw: ["Python", "Machine Learning", "Quantum Computing", "C++"],
        tagsRaw: ["MeitY", "IndiaAI", "Quantum", "Govt Fellowship"],
        rawContent: "Eligible for pre-final and final year B.Tech/M.Tech with CGPA >= 7.5.",
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
