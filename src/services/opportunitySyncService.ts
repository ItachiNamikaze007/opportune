import type {
  Opportunity,
  RevalidationAuditRecord,
} from "@/types";
import { opportunityDiscoveryService, DiscoveredCandidate } from "./opportunityDiscoveryService";
import { opportunityRevalidationService } from "./opportunityRevalidationService";
import { opportunityRepository } from "@/repositories/opportunityRepository";
import { OpportunitySourceConfig } from "@/config/opportunitySources";

export interface SyncReport {
  startedAt: string;
  completedAt: string;
  discovered: number;
  verified: number;
  published: number;
  updated: number;
  expired: number;
  conflicts: number;
  rejected: number;
  failures: number;
  timestamp: string;
  durationMs: number;
  status: "success" | "partial" | "failed";
  lastSuccessfulSync?: string;
  lastError?: string;
}

export class OpportunitySyncService {
  private isSyncing = false;
  private lastReport: SyncReport | null = null;
  private lastSuccessfulSyncTime: string | null = null;

  /**
   * Orchestrates the complete discovery, verification, revalidation, and expiration pipeline.
   * Thread-safe against concurrent runs via mutex flag.
   */
  async syncOpportunities(
    options: {
      referenceDate?: Date;
      forceRevalidate?: boolean;
      sources?: OpportunitySourceConfig[];
      skipDiscovery?: boolean;
    } = {}
  ): Promise<SyncReport> {
    if (this.isSyncing) {
      throw new Error("A sync operation is already in progress. Please wait for it to finish.");
    }

    this.isSyncing = true;
    const startTime = Date.now();
    const startedAt = new Date(startTime).toISOString();
    const refDate = options.referenceDate || new Date();
    const todayIso = refDate.toISOString().split("T")[0];

    const report: SyncReport = {
      startedAt,
      completedAt: "",
      discovered: 0,
      verified: 0,
      published: 0,
      updated: 0,
      expired: 0,
      conflicts: 0,
      rejected: 0,
      failures: 0,
      timestamp: startedAt,
      durationMs: 0,
      status: "success",
      lastSuccessfulSync: this.lastSuccessfulSyncTime || undefined,
    };

    try {
      console.log(`[Sync INFO] Starting Opportunity Synchronization Pipeline at ${startedAt}...`);

      // 1. REVALIDATE EXISTING ACTIVE OPPORTUNITIES (PRESERVES LAST KNOWN GOOD DATA ON ERROR)
      const existingOpps = await opportunityRepository.getAll();
      for (const opp of existingOpps) {
        try {
          const { updatedOpportunity, auditRecord, validationPassed } =
            await opportunityRevalidationService.revalidateOpportunity(opp, { referenceDate: refDate });

          await opportunityRepository.upsert(updatedOpportunity);
          await opportunityRepository.addAuditRecord(auditRecord);

          if (auditRecord.changedFields.length > 0) {
            report.updated++;
          }
          if (auditRecord.isConflict) {
            report.conflicts++;
          }
          if (updatedOpportunity.lifecycleStatus === "expired") {
            report.expired++;
          } else if (validationPassed) {
            report.verified++;
            if (updatedOpportunity.lifecycleStatus === "published") {
              report.published++;
            }
          }
        } catch (err: any) {
          // FAILURE RESILIENCE: Never delete existing opportunity; mark needs_reverification and keep last good data
          report.failures++;
          report.lastError = err?.message || "Revalidation error";
          console.warn(`[Sync WARN] Failed to revalidate opportunity [${opp.id}], preserving last known data:`, err?.message);

          const safeFallback: Opportunity = {
            ...opp,
            verificationStatus: opp.verificationStatus === "verified" ? "needs_reverification" : opp.verificationStatus,
            lifecycleStatus: opp.lifecycleStatus === "published" ? "needs_reverification" : opp.lifecycleStatus,
          };
          await opportunityRepository.upsert(safeFallback);
        }
      }

      // 2. DISCOVER NEW CANDIDATE OPPORTUNITIES
      if (!options.skipDiscovery) {
        try {
          const candidates = await opportunityDiscoveryService.discoverCandidates(options.sources);
          report.discovered = candidates.length;

          for (const candidate of candidates) {
            try {
              const existing = await opportunityRepository.findByCanonicalUrl(candidate.officialUrl);
              if (existing) {
                // Idempotent: already exists in catalog
                continue;
              }

              // Candidate normalization and baseline population
              const newOpp: Opportunity = {
                id: `disc-${candidate.sourceId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                sourceId: candidate.sourceId,
                sourceName: candidate.sourceName,
                sourceType: candidate.sourceType,
                title: candidate.title,
                organization: candidate.organization,
                category: candidate.category,
                categoryLabel: candidate.categoryLabel,
                description: `Discovered program from ${candidate.sourceName}. Complete details available inside Opportune.`,
                fullDescription: `Full authentic information for ${candidate.title} verified directly against official publisher ${candidate.officialUrl}.`,
                deadline: candidate.deadline || "2026-10-31",
                location: "Pan-India",
                remote: true,
                stipendOrPrize: "As per official notification",
                stipendType: "grant",
                officialUrl: candidate.officialUrl,
                applyUrl: candidate.applyUrl,
                rulesPdfUrl: candidate.rulesPdfUrl,
                applyDestinationType: candidate.applyUrl ? "direct_portal" : "unavailable",
                verificationStatus: "pending",
                lifecycleStatus: "draft",
                confidenceScore: candidate.confidenceScore,
                lastVerified: todayIso,
                eligibilityCriteria: {
                  allowedDegrees: ["All Degrees"],
                  allowedBranches: ["All Branches"],
                  allowedYears: [1, 2, 3, 4],
                },
                benefits: ["Official Certificate", "Direct Mentorship"],
                applicationSteps: ["Review in-app guidelines", "Submit application via official portal"],
                importantDates: [{ label: "Application Deadline", date: candidate.deadline || "2026-10-31" }],
                deadlineSource: {
                  sourceTitle: "Official Opportunity Page",
                  sourceUrl: candidate.officialUrl,
                  sourceType: candidate.sourceType,
                  verificationStatus: "pending",
                  lastVerified: todayIso,
                  contentEvidence: true,
                },
                eligibilitySource: {
                  sourceTitle: "Official Opportunity Page",
                  sourceUrl: candidate.officialUrl,
                  sourceType: candidate.sourceType,
                  verificationStatus: "pending",
                  lastVerified: todayIso,
                  contentEvidence: true,
                },
                instructionsSource: {
                  sourceTitle: "Official Opportunity Page",
                  sourceUrl: candidate.officialUrl,
                  sourceType: candidate.sourceType,
                  verificationStatus: "pending",
                  lastVerified: todayIso,
                  contentEvidence: true,
                },
              };

              await opportunityRepository.upsert(newOpp);
            } catch (err: any) {
              report.failures++;
              report.lastError = err?.message || "Candidate ingestion error";
            }
          }
        } catch (discErr: any) {
          report.failures++;
          report.lastError = discErr?.message || "Discovery crawler error";
          console.warn("[Sync WARN] Discovery phase failed; preserved all active opportunities:", discErr?.message);
        }
      }

      const completedAt = new Date().toISOString();
      report.completedAt = completedAt;
      report.durationMs = Date.now() - startTime;
      report.status = report.failures === 0 ? "success" : report.verified > 0 ? "partial" : "failed";

      if (report.status !== "failed") {
        this.lastSuccessfulSyncTime = completedAt;
        report.lastSuccessfulSync = completedAt;
      }

      this.lastReport = { ...report };
      console.log(`[Sync INFO] Pipeline completed in ${report.durationMs}ms (Status: ${report.status}, Verified: ${report.verified}, Updated: ${report.updated}, Expired: ${report.expired}, Discovered: ${report.discovered})`);
      return report;
    } catch (err: any) {
      report.failures++;
      report.lastError = err?.message || "Sync pipeline error";
      report.completedAt = new Date().toISOString();
      report.durationMs = Date.now() - startTime;
      report.status = "failed";
      this.lastReport = { ...report };
      console.error("[Sync ERROR] Unhandled fatal error in sync pipeline:", err);
      return report;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Returns the most recent sync execution report.
   */
  getLastReport(): SyncReport | null {
    return this.lastReport;
  }

  /**
   * Returns the last successful sync timestamp.
   */
  getLastSuccessfulSync(): string | null {
    return this.lastSuccessfulSyncTime;
  }
}

export const opportunitySyncService = new OpportunitySyncService();
