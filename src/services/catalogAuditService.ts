import { Opportunity } from "@/types";
import { getOpportunityStatus, OpportunityStatusResult } from "./opportunityStatusResolver";

export interface OpportunityAuditItem {
  id: string;
  title: string;
  organization: string;
  isDemo: boolean;
  storedDeadline: string;
  statusResult: OpportunityStatusResult;
  officialUrl: string;
  applyUrl?: string;
  actionRequired: "Mark Expired" | "Review Official Source" | "Active - No Action" | "Sample Demo Data" | "Stale - Re-verify";
  recommendation: string;
}

export interface CatalogAuditReport {
  generatedAt: string;
  referenceDate: string;
  totalAudited: number;
  activeCount: number;
  closingSoonCount: number;
  expiredCount: number;
  unknownCount: number;
  demoCount: number;
  staleCount: number;
  items: OpportunityAuditItem[];
}

export const catalogAuditService = {
  /**
   * Performs an exhaustive freshness and deadline audit across all opportunities in the catalog.
   */
  generateAuditReport(
    catalog: Opportunity[],
    referenceDate: Date = new Date("2026-08-20")
  ): CatalogAuditReport {
    let activeCount = 0;
    let closingSoonCount = 0;
    let expiredCount = 0;
    let unknownCount = 0;
    let demoCount = 0;
    let staleCount = 0;

    const items: OpportunityAuditItem[] = catalog.map((opp) => {
      const statusResult = getOpportunityStatus(opp, referenceDate);

      let actionRequired: OpportunityAuditItem["actionRequired"] = "Active - No Action";
      let recommendation = "Opportunity is current and active.";

      if (statusResult.status === "EXPIRED" || statusResult.status === "REGISTRATION_CLOSED") {
        expiredCount++;
        actionRequired = "Mark Expired";
        recommendation = `Stored deadline (${opp.deadline}) has passed relative to ${referenceDate.toISOString().split("T")[0]}. Suppress from active recommendations.`;
      } else if (statusResult.status === "UNKNOWN") {
        unknownCount++;
        actionRequired = "Review Official Source";
        recommendation = "Status cannot be determined with certainty. Maintain 'Needs Verification' state.";
      } else if (statusResult.status === "CLOSING_SOON") {
        closingSoonCount++;
        actionRequired = opp.isDemo ? "Sample Demo Data" : "Active - No Action";
        recommendation = `Urgent deadline closing in ${statusResult.daysRemaining} days.`;
      } else if (opp.isDemo) {
        demoCount++;
        actionRequired = "Sample Demo Data";
        recommendation = "Sample demo dataset opportunity with illustrative dates.";
      } else {
        activeCount++;
      }

      if (statusResult.freshnessState === "Stale") {
        staleCount++;
        actionRequired = "Stale - Re-verify";
        recommendation = "More than 30 days since last official verification. Re-trigger ingestion connector.";
      }

      return {
        id: opp.id,
        title: opp.title,
        organization: opp.organization,
        isDemo: Boolean(opp.isDemo),
        storedDeadline: opp.deadline,
        statusResult,
        officialUrl: opp.officialUrl,
        applyUrl: opp.applyUrl,
        actionRequired,
        recommendation,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      referenceDate: referenceDate.toISOString().split("T")[0],
      totalAudited: catalog.length,
      activeCount,
      closingSoonCount,
      expiredCount,
      unknownCount,
      demoCount,
      staleCount,
      items,
    };
  },
};
