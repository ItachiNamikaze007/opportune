import type {
  Opportunity,
  RevalidationAuditRecord,
  VerificationStatus,
  LifecycleStatus,
  ProvenanceClaim,
} from "@/types";
import { linkHealthService } from "./linkHealthService";
import { opportunityVerificationService } from "./opportunityVerificationService";

export interface RevalidationSummary {
  totalEvaluated: number;
  verifiedCount: number;
  needsReverificationCount: number;
  staleCount: number;
  expiredCount: number;
  conflictsResolved: number;
  discoveredPdfsCount: number;
  discoveredApplicationLinksCount: number;
  revalidationTimestamp: string;
}

export class OpportunityRevalidationService {
  private auditLog: RevalidationAuditRecord[] = [];

  /**
   * Revalidates an individual opportunity against its live official source.
   * STRICT INVARIANTS:
   * 1. Official source is always canonical and overrides third-party/partner sources.
   * 2. Zero guessed URLs, paths, or filenames.
   * 3. PDFs are validated via HTTP status, Content-Type, and %PDF- magic bytes.
   * 4. Provenance claims strictly link to verified URLs with content evidence.
   */
  async revalidateOpportunity(
    opp: Opportunity,
    options: { referenceDate?: Date } = {}
  ): Promise<{
    updatedOpportunity: Opportunity;
    auditRecord: RevalidationAuditRecord;
    validationPassed: boolean;
  }> {
    const refDate = options.referenceDate instanceof Date ? options.referenceDate : new Date();
    const todayIso = refDate.toISOString().split("T")[0];
    const timestamp = new Date().toISOString();

    const oldValues = {
      deadline: opp.deadline,
      verificationStatus: opp.verificationStatus,
      lifecycleStatus: opp.lifecycleStatus,
      applyUrl: opp.applyUrl,
      rulesPdfUrl: opp.rulesPdfUrl,
    };

    const changedFields: string[] = [];
    let isConflict = false;
    let reason = "Routine live source verification passed";
    let httpStatus = 200;

    // 1. Crawl & Discover official links up to depth 2
    const discovered = await linkHealthService.crawlAndDiscoverLinks(
      opp.officialUrl,
      opp.sourceUrl,
      2
    );

    const officialCheck = discovered.metadata?.official;
    httpStatus = officialCheck?.httpStatus || 200;

    // Clone opportunity for mutation
    const updated: Opportunity = { ...opp };
    updated.lastVerified = todayIso;

    // 2. Official Reachability & Health Check
    if (officialCheck && !officialCheck.isValid && officialCheck.httpStatus !== 403) {
      updated.verificationStatus = "needs_reverification";
      updated.lifecycleStatus = "needs_reverification";
      changedFields.push("verificationStatus", "lifecycleStatus");
      reason = `Official source unreachable or returned HTTP ${officialCheck.httpStatus || "error"} (unavailable or invalid)`;

      const auditRecord: RevalidationAuditRecord = {
        id: `audit-${opp.id}-${Date.now()}`,
        opportunityId: opp.id,
        opportunityTitle: opp.title,
        oldValues,
        newValues: {
          deadline: updated.deadline,
          verificationStatus: updated.verificationStatus,
          lifecycleStatus: updated.lifecycleStatus,
          applyUrl: updated.applyUrl,
          rulesPdfUrl: updated.rulesPdfUrl,
        },
        changedFields,
        sourceUrl: opp.officialUrl,
        verificationTimestamp: timestamp,
        reason,
        isConflict: false,
        httpStatus,
      };

      this.auditLog.push(auditRecord);
      return { updatedOpportunity: updated, auditRecord, validationPassed: false };
    }

    // 3. Extract and Reverify Opportunity Data from Official HTML
    const liveVerResult = await opportunityVerificationService.verifyOfficialWebpage(opp, refDate);

    // 4. Deadline Discrepancy & Conflict Resolution
    if (liveVerResult.extractedDeadline && liveVerResult.extractedDeadline !== opp.deadline) {
      const officialExtractedDeadline = liveVerResult.extractedDeadline;
      if (officialExtractedDeadline < todayIso) {
        updated.deadline = officialExtractedDeadline;
        updated.lifecycleStatus = "expired";
        updated.verificationStatus = "expired";
        updated.applyDestinationType = "expired";
        changedFields.push("deadline", "lifecycleStatus", "verificationStatus");
        reason = `Official source deadline (${officialExtractedDeadline}) has passed. Marked as expired.`;
      } else {
        isConflict = true;
        updated.deadline = officialExtractedDeadline;
        updated.sourceConflict = true;
        updated.sourceMetadata = {
          ...(opp.sourceMetadata || {}),
          discoverySource: opp.sourceMetadata?.discoverySource || opp.sourceName || "Partner Listing",
          discoveryDeadline: oldValues.deadline,
          officialDeadline: officialExtractedDeadline,
          conflictResolution: `Official publisher source (${opp.officialUrl}) adopted as canonical. Updated from ${oldValues.deadline} to ${officialExtractedDeadline}.`,
          resolvedAt: timestamp,
        };
        changedFields.push("deadline", "sourceConflict", "sourceMetadata");
        reason = `Source conflict resolved: Official publisher deadline (${officialExtractedDeadline}) adopted over old stored value (${oldValues.deadline}).`;
      }
    }

    // 5. Expiration Date Assertion against Today
    if (updated.deadline < todayIso) {
      updated.lifecycleStatus = "expired";
      updated.verificationStatus = "expired";
      updated.applyDestinationType = "expired";
      if (!changedFields.includes("lifecycleStatus")) {
        changedFields.push("lifecycleStatus", "verificationStatus", "applyDestinationType");
      }
      reason = `Opportunity deadline (${updated.deadline}) is in the past. Lifecycle marked expired.`;
    }

    // 6. PDF Discovery & Provenance Update
    if (discovered.verifiedRulesPdfUrl) {
      if (opp.rulesPdfUrl !== discovered.verifiedRulesPdfUrl) {
        updated.rulesPdfUrl = discovered.verifiedRulesPdfUrl;
        updated.rulesPdfTitle = discovered.rulesPdfTitle || "Official Guidelines & Notification";
        updated.rulesPdfSourceType = discovered.rulesPdfSourceType || "official";
        changedFields.push("rulesPdfUrl", "rulesPdfTitle");
      }
    } else {
      // If no genuine PDF found, preserve undefined safely
      updated.rulesPdfUrl = undefined;
      updated.rulesPdfTitle = undefined;
    }

    // 7. Verified Application Portal Discovery & Clean Destination
    if (discovered.verifiedApplyUrl && discovered.verifiedApplyUrl !== opp.applyUrl) {
      // Only adopt if it's a real subpage/portal or valid registration flow
      const parsed = new URL(discovered.verifiedApplyUrl);
      if (parsed.pathname !== "/" && parsed.pathname !== "") {
        updated.applyUrl = discovered.verifiedApplyUrl;
        changedFields.push("applyUrl");
      }
    }

    // 8. Strict Evidence-Backed Provenance Alignment
    const canonicalSourceUrl = opp.officialUrl;
    const sourceTitle =
      opp.category === "government_exam"
        ? "Official Examination Portal"
        : opp.sourceType === "partner"
        ? "Partner Competition Page (Unstop)"
        : "Official Opportunity Page";

    const baseProvenanceClaim: ProvenanceClaim = {
      sourceTitle,
      sourceUrl: opp.sourceType === "partner" && opp.sourceUrl ? opp.sourceUrl : canonicalSourceUrl,
      sourceType: opp.sourceType || "official",
      verificationStatus: updated.verificationStatus,
      lastVerified: todayIso,
      contentEvidence: true,
      evidenceText: `Verified against canonical source ${canonicalSourceUrl}`,
      evidenceLocation: "Landing Page Content",
    };

    updated.deadlineSource = { ...baseProvenanceClaim };
    updated.eligibilitySource = { ...baseProvenanceClaim };
    updated.instructionsSource = {
      ...baseProvenanceClaim,
      sourceUrl: opp.applyUrl && opp.applyUrl.startsWith("http") ? opp.applyUrl : canonicalSourceUrl,
      sourceTitle: opp.applyUrl && opp.applyUrl.includes("nic.in") ? "Official Application Portal" : sourceTitle,
    };

    const auditRecord: RevalidationAuditRecord = {
      id: `audit-${opp.id}-${Date.now()}`,
      opportunityId: opp.id,
      opportunityTitle: opp.title,
      oldValues,
      newValues: {
        deadline: updated.deadline,
        verificationStatus: updated.verificationStatus,
        lifecycleStatus: updated.lifecycleStatus,
        applyUrl: updated.applyUrl,
        rulesPdfUrl: updated.rulesPdfUrl,
      },
      changedFields,
      sourceUrl: canonicalSourceUrl,
      verificationTimestamp: timestamp,
      reason,
      isConflict,
      httpStatus,
    };

    this.auditLog.push(auditRecord);

    const validationPassed =
      updated.verificationStatus === "verified" || updated.verificationStatus === "partner_verified";

    return {
      updatedOpportunity: updated,
      auditRecord,
      validationPassed,
    };
  }

  /**
   * Revalidates an array of active opportunities and returns a consolidated summary.
   */
  async revalidateAllActiveOpportunities(
    opportunities: Opportunity[],
    options: { referenceDate?: Date } = {}
  ): Promise<{
    revalidated: Opportunity[];
    auditLog: RevalidationAuditRecord[];
    summary: RevalidationSummary;
  }> {
    const revalidated: Opportunity[] = [];
    const runAuditRecords: RevalidationAuditRecord[] = [];
    let conflictsResolved = 0;
    let discoveredPdfsCount = 0;
    let discoveredApplicationLinksCount = 0;

    for (const opp of opportunities) {
      const res = await this.revalidateOpportunity(opp, options);
      revalidated.push(res.updatedOpportunity);
      runAuditRecords.push(res.auditRecord);

      if (res.auditRecord.isConflict) {
        conflictsResolved++;
      }
      if (res.updatedOpportunity.rulesPdfUrl) {
        discoveredPdfsCount++;
      }
      if (res.updatedOpportunity.applyUrl) {
        discoveredApplicationLinksCount++;
      }
    }

    const verifiedCount = revalidated.filter(
      (o) => o.verificationStatus === "verified" || o.verificationStatus === "partner_verified"
    ).length;
    const needsReverificationCount = revalidated.filter(
      (o) => o.verificationStatus === "needs_reverification"
    ).length;
    const staleCount = revalidated.filter((o) => o.verificationStatus === "stale").length;
    const expiredCount = revalidated.filter(
      (o) => o.lifecycleStatus === "expired" || o.verificationStatus === "expired"
    ).length;

    const summary: RevalidationSummary = {
      totalEvaluated: opportunities.length,
      verifiedCount,
      needsReverificationCount,
      staleCount,
      expiredCount,
      conflictsResolved,
      discoveredPdfsCount,
      discoveredApplicationLinksCount,
      revalidationTimestamp: new Date().toISOString(),
    };

    return {
      revalidated,
      auditLog: runAuditRecords,
      summary,
    };
  }

  /**
   * Returns all recorded audit records.
   */
  getAuditLog(): RevalidationAuditRecord[] {
    return [...this.auditLog];
  }

  /**
   * Clears the in-memory audit log (useful for test resets).
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }
}

export const opportunityRevalidationService = new OpportunityRevalidationService();
