import type { Opportunity } from "@/types";
import type { ChangeDetectionResult, NormalizedOpportunity } from "./types";

/**
 * Compares an incoming opportunity against an existing opportunity record
 * to detect specific changes in deadlines, eligibility rules, or descriptions.
 */
export function detectOpportunityChanges(
  existing: Opportunity | null | undefined,
  incoming: NormalizedOpportunity
): ChangeDetectionResult {
  if (!existing) {
    return {
      changeType: "new_opportunity",
      hasChanges: true,
      diffs: {
        opportunity: { old: null, new: incoming.title },
      },
    };
  }

  const diffs: Record<string, { old: any; new: any }> = {};

  // Check Expiration against current date
  const now = new Date().toISOString().split("T")[0];
  const isIncomingExpired = incoming.deadline < now;
  const isExistingExpired = existing.deadline < now;

  if (isIncomingExpired && !isExistingExpired) {
    diffs.expiration = { old: existing.deadline, new: incoming.deadline };
    return {
      changeType: "expired",
      hasChanges: true,
      diffs,
    };
  }

  // 1. Check Deadline Change
  const existingDeadline = existing.deadline.split("T")[0];
  const incomingDeadline = incoming.deadline.split("T")[0];
  if (existingDeadline !== incomingDeadline) {
    diffs.deadline = { old: existingDeadline, new: incomingDeadline };
  }

  // 2. Check Eligibility Criteria Change
  const existingCrit = existing.eligibilityCriteria;
  const incomingCrit = incoming.eligibilityCriteria;

  const minCgpaChanged = (existingCrit.minCGPA || 0) !== (incomingCrit.minCGPA || 0);
  const maxAgeChanged = (existingCrit.maxAge || 0) !== (incomingCrit.maxAge || 0);
  const degreesChanged =
    existingCrit.allowedDegrees.sort().join(",") !==
    incomingCrit.allowedDegrees.sort().join(",");
  const branchesChanged =
    existingCrit.allowedBranches.sort().join(",") !==
    incomingCrit.allowedBranches.sort().join(",");

  if (minCgpaChanged || maxAgeChanged || degreesChanged || branchesChanged) {
    diffs.eligibility = {
      old: {
        minCGPA: existingCrit.minCGPA,
        maxAge: existingCrit.maxAge,
        degrees: existingCrit.allowedDegrees,
      },
      new: {
        minCGPA: incomingCrit.minCGPA,
        maxAge: incomingCrit.maxAge,
        degrees: incomingCrit.allowedDegrees,
      },
    };
  }

  // 3. Check Description Change
  if (
    existing.description.trim().toLowerCase() !==
    incoming.description.trim().toLowerCase()
  ) {
    diffs.description = {
      old: existing.description.substring(0, 80),
      new: incoming.description.substring(0, 80),
    };
  }

  // 4. Check Stipend Change
  if (
    existing.stipendOrPrize.trim().toLowerCase() !==
    incoming.stipendOrPrize.trim().toLowerCase()
  ) {
    diffs.stipend = {
      old: existing.stipendOrPrize,
      new: incoming.stipendOrPrize,
    };
  }

  // Determine Primary Change Type
  if (Object.keys(diffs).length === 0) {
    return {
      changeType: "no_change",
      hasChanges: false,
      diffs: {},
    };
  }

  if (diffs.deadline) {
    return { changeType: "deadline_changed", hasChanges: true, diffs };
  }

  if (diffs.eligibility) {
    return { changeType: "eligibility_changed", hasChanges: true, diffs };
  }

  if (diffs.description) {
    return { changeType: "description_changed", hasChanges: true, diffs };
  }

  return { changeType: "description_changed", hasChanges: true, diffs };
}
