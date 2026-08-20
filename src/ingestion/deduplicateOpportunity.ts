import type { Opportunity } from "@/types";
import type { DeduplicationResult, NormalizedOpportunity } from "./types";

/**
 * Creates a clean normalized key for an organization name
 * e.g. "Google Developers & Research" -> "google developers research"
 */
export function canonicalOrganization(org: string): string {
  return (org || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Creates a clean normalized key for a title
 * e.g. "Google AI Challenge 2026 (Batch of 2027)" -> "google ai challenge 2026"
 */
export function canonicalTitle(title: string): string {
  return (title || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // remove text inside parentheses
    .replace(/\[[^\]]*\]/g, "") // remove text inside brackets
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Creates a composite canonical signature
 */
export function makeCanonicalKey(org: string, title: string, deadline?: string): string {
  const normOrg = canonicalOrganization(org);
  const normTitle = canonicalTitle(title);
  const normDeadline = deadline ? deadline.split("T")[0] : "any";
  return `${normOrg}:::${normTitle}:::${normDeadline}`;
}

/**
 * Calculates string similarity using Jaccard token overlap
 */
function calculateJaccardSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.split(" ").filter((w) => w.length > 1));
  const set2 = new Set(str2.split(" ").filter((w) => w.length > 1));
  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

/**
 * Checks if incoming normalized opportunity is a duplicate of any existing opportunity
 */
export function deduplicateOpportunity(
  incoming: NormalizedOpportunity,
  existingOpportunities: Opportunity[]
): DeduplicationResult {
  const incomingKey = makeCanonicalKey(incoming.organization, incoming.title, incoming.deadline);
  const incomingNormOrg = canonicalOrganization(incoming.organization);
  const incomingNormTitle = canonicalTitle(incoming.title);

  for (const existing of existingOpportunities) {
    // 1. Exact Canonical Key Match
    const existingKey = makeCanonicalKey(existing.organization, existing.title, existing.deadline);
    if (incomingKey === existingKey) {
      return {
        isDuplicate: true,
        duplicateOf: existing.id,
        canonicalKey: incomingKey,
        matchConfidence: 1.0,
        reason: `Exact match on organization, title, and deadline with ${existing.id}`,
      };
    }

    // 2. Exact Title + Same Org match (even if deadline is slightly shifted or open)
    const existingNormOrg = canonicalOrganization(existing.organization);
    const existingNormTitle = canonicalTitle(existing.title);

    const isSameOrg =
      incomingNormOrg === existingNormOrg ||
      incomingNormOrg.includes(existingNormOrg) ||
      existingNormOrg.includes(incomingNormOrg);

    if (isSameOrg) {
      if (incomingNormTitle === existingNormTitle) {
        return {
          isDuplicate: true,
          duplicateOf: existing.id,
          canonicalKey: incomingKey,
          matchConfidence: 0.95,
          reason: `Exact title and organization match with existing opportunity ${existing.id}`,
        };
      }

      // High token similarity match (≥ 0.8)
      const similarity = calculateJaccardSimilarity(incomingNormTitle, existingNormTitle);
      if (similarity >= 0.8) {
        return {
          isDuplicate: true,
          duplicateOf: existing.id,
          canonicalKey: incomingKey,
          matchConfidence: Number(similarity.toFixed(2)),
          reason: `High fuzzy similarity (${Math.round(similarity * 100)}%) with ${existing.id}`,
        };
      }
    }
  }

  // No duplicate found
  return {
    isDuplicate: false,
    canonicalKey: incomingKey,
    matchConfidence: 0,
  };
}
