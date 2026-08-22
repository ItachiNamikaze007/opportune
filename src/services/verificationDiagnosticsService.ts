import type { OpportunityCategory, SourceProvenanceType } from "@/types";

export interface CandidateDiagnosticRecord {
  candidateId: string;
  candidateTitle: string;
  sourceName: string;
  sourceType: SourceProvenanceType;
  sourceUrl: string;
  category: OpportunityCategory;
  officialOrganization: string;
  officialUrlFound: boolean;
  officialUrlReachable: boolean;
  deadlineFound: boolean;
  eligibilityFound: boolean;
  confidenceScore: number;
  dedupMatched: boolean;
  finalDecision: "published" | "pending" | "rejected";
  reason: string;
  missingEvidence: string[];
}

export interface SourceConversionMetrics {
  sourceName: string;
  discovered: number;
  normalized: number;
  deduplicated: number;
  pending: number;
  rejected: number;
  officiallyVerified: number;
  published: number;
  conversionRatePercent: number;
}

export class VerificationDiagnosticsService {
  private diagnosticRecords: CandidateDiagnosticRecord[] = [];

  clearDiagnostics(): void {
    this.diagnosticRecords = [];
  }

  recordDiagnostic(record: CandidateDiagnosticRecord): void {
    this.diagnosticRecords.push(record);
  }

  getAllDiagnostics(): CandidateDiagnosticRecord[] {
    return [...this.diagnosticRecords];
  }

  getDiagnosticsByDecision(decision: "published" | "pending" | "rejected"): CandidateDiagnosticRecord[] {
    return this.diagnosticRecords.filter((r) => r.finalDecision === decision);
  }

  getSourceConversionMetrics(): SourceConversionMetrics[] {
    const map = new Map<string, SourceConversionMetrics>();

    for (const rec of this.diagnosticRecords) {
      if (!map.has(rec.sourceName)) {
        map.set(rec.sourceName, {
          sourceName: rec.sourceName,
          discovered: 0,
          normalized: 0,
          deduplicated: 0,
          pending: 0,
          rejected: 0,
          officiallyVerified: 0,
          published: 0,
          conversionRatePercent: 0,
        });
      }

      const metric = map.get(rec.sourceName)!;
      metric.discovered++;
      metric.normalized++;

      if (rec.dedupMatched) {
        metric.deduplicated++;
      }

      if (rec.finalDecision === "published") {
        metric.officiallyVerified++;
        metric.published++;
      } else if (rec.finalDecision === "pending") {
        metric.pending++;
      } else if (rec.finalDecision === "rejected") {
        metric.rejected++;
      }
    }

    for (const metric of map.values()) {
      if (metric.discovered > 0) {
        metric.conversionRatePercent = parseFloat(
          ((metric.published / metric.discovered) * 100).toFixed(1)
        );
      }
    }

    return Array.from(map.values());
  }

  getCategoryDiagnosticBreakdown(): {
    category: string;
    discovered: number;
    normalized: number;
    verified: number;
    published: number;
    publicSearchEligible: number;
  }[] {
    const categories = [
      "hackathon",
      "scholarship",
      "internship",
      "fellowship",
      "competition",
      "research",
      "government_exam",
    ];

    return categories.map((cat) => {
      const records = this.diagnosticRecords.filter(
        (r) => r.category === cat || (r.category as string).includes(cat)
      );
      const verified = records.filter((r) => r.finalDecision === "published").length;

      return {
        category: cat,
        discovered: records.length,
        normalized: records.length,
        verified,
        published: verified,
        publicSearchEligible: verified,
      };
    });
  }
}

export const verificationDiagnosticsService = new VerificationDiagnosticsService();
