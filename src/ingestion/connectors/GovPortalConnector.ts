import type {
  OpportunitySourceConnector,
  NormalizedOpportunity,
  RawOpportunityRecord,
  IngestionValidationResult,
} from "../types";
import { normalizeOpportunity, validateOpportunity } from "../normalizeOpportunity";
import type { SourceStatus, SourceType } from "@/types/database";

/**
 * Example Safe Official Government Source Connector
 * Fetches structured notification data from official public schemes.
 * Respects robots.txt, terms of service, and never bypasses authentication.
 */
export class GovPortalConnector implements OpportunitySourceConnector {
  readonly sourceId: string = "src-gov-niti";
  readonly sourceName: string = "NITI Aayog Official Scheme Portal";
  readonly sourceUrl: string = "https://niti.gov.in/internship-scheme";
  readonly sourceType: SourceType = "government";
  readonly isOfficial: boolean = true;
  readonly status: SourceStatus = "active";
  readonly fetchFrequency: string = "daily";

  /**
   * Fetches raw records from the official source endpoint / public feed.
   */
  async fetch(): Promise<RawOpportunityRecord[]> {
    // In production, this performs a safe HTTP GET request to the official feed/API endpoint.
    // For this example connector, we provide structured raw items reflecting official bulletin releases.
    return [
      {
        rawId: "niti-winter-2026",
        sourceId: this.sourceId,
        sourceUrl: this.sourceUrl,
        officialUrl: "https://niti.gov.in/internship-scheme",
        applyUrl: undefined,
        title: "NITI Aayog National Internship Scheme (Winter Batch 2026)",
        organization: "NITI Aayog, Government of India",
        categoryRaw: "government_internship",
        descriptionRaw:
          "Work closely with senior policy makers, economists, and technical advisors on national digital transformation initiatives.",
        fullDescriptionRaw:
          "NITI Aayog offers an institutional internship program for passionate undergraduate and postgraduate students enrolled in recognized Indian and international universities.",
        deadlineRaw: "2026-09-10",
        locationRaw: "New Delhi (Sansad Marg)",
        isRemote: false,
        stipendRaw: "Govt Certificate & Travel Allowance",
        degreesRaw: ["B.Tech", "B.E.", "B.Sc", "M.Sc", "MCA", "M.Tech"],
        branchesRaw: [
          "Computer Science",
          "Economics",
          "Public Policy",
          "Electronics",
          "Data Science",
          "All Branches",
        ],
        yearsRaw: [2, 3, 4],
        cgpaRaw: 7.5,
        skillsRaw: ["Data Science", "Python", "Technical Writing"],
        tagsRaw: ["Policy", "Govt of India", "Prestigious", "Data & Tech"],
      },
      {
        rawId: "nic-summer-2027",
        sourceId: this.sourceId,
        sourceUrl: "https://www.nic.in/internship",
        officialUrl: "https://www.nic.in/internship",
        applyUrl: "https://www.nic.in/internship/register",
        title: "NIC National Informatics Centre Summer Internship 2027",
        organization: "National Informatics Centre, Ministry of MeitY",
        categoryRaw: "government_internship",
        descriptionRaw:
          "Build citizen-facing e-Governance platforms, DigiLocker extensions, and cybersecurity defenses for central ministries.",
        deadlineRaw: "2026-10-10",
        locationRaw: "New Delhi / State State Units",
        isRemote: false,
        stipendRaw: "₹10,000/month + Govt Certificate",
        degreesRaw: ["B.Tech", "B.E.", "MCA", "M.Tech"],
        branchesRaw: ["Computer Science", "IT", "Cybersecurity", "Electronics"],
        yearsRaw: [3, 4],
        cgpaRaw: 7.0,
        skillsRaw: ["JavaScript", "Python", "SQL", "Cybersecurity"],
        tagsRaw: ["MeitY", "Cybersecurity", "DigiLocker", "Govt Internship"],
      },
    ];
  }

  /**
   * Normalizes raw record into standard NormalizedOpportunity
   */
  normalize(raw: RawOpportunityRecord): NormalizedOpportunity {
    return normalizeOpportunity(raw, this.sourceId, this.isOfficial);
  }

  /**
   * Validates normalized opportunity before publishing
   */
  validate(item: NormalizedOpportunity): IngestionValidationResult {
    return validateOpportunity(item);
  }
}
