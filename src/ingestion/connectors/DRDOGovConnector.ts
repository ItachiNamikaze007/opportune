import type {
  OpportunitySourceConnector,
  NormalizedOpportunity,
  RawOpportunityRecord,
  IngestionValidationResult,
} from "../types";
import { normalizeOpportunity, validateOpportunity } from "../normalizeOpportunity";
import type { SourceStatus, SourceType } from "@/types/database";

export class DRDOGovConnector implements OpportunitySourceConnector {
  readonly sourceId: string = "src-gov-drdo";
  readonly sourceName: string = "DRDO Recruitment & Assessment Centre (RAC)";
  readonly sourceUrl: string = "https://rac.gov.in";
  readonly sourceType: SourceType = "research";
  readonly isOfficial: boolean = true;
  readonly status: SourceStatus = "active";
  readonly fetchFrequency: string = "weekly";

  async fetch(): Promise<RawOpportunityRecord[]> {
    return [
      {
        rawId: "drdo-jrf-fellowship-2026",
        sourceId: this.sourceId,
        sourceUrl: this.sourceUrl,
        officialUrl: "https://rac.gov.in",
        applyUrl: undefined,
        title: "DRDO Junior Research Fellowship (JRF) in Autonomous Systems 2026",
        organization: "Defence Research & Development Organisation (DRDO)",
        categoryRaw: "research_internship",
        descriptionRaw:
          "Research fellowship at Centre for Artificial Intelligence and Robotics (CAIR) focusing on autonomous robotics, computer vision, and UAV guidance systems.",
        deadlineRaw: "2026-10-05",
        locationRaw: "Bengaluru (CAIR Lab)",
        isRemote: false,
        stipendRaw: "₹37,000/month + HRA (JRF Grant)",
        degreesRaw: ["B.Tech", "B.E.", "M.Tech"],
        branchesRaw: ["Computer Science", "Electronics", "Robotics", "Mechanical"],
        yearsRaw: [4],
        cgpaRaw: 7.0,
        skillsRaw: ["ROS", "Python", "C++", "Computer Vision", "Control Systems"],
        tagsRaw: ["DRDO", "Robotics", "Defence", "Research Fellowship"],
        rawContent: "First class degree with valid GATE score or national level test eligibility.",
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
