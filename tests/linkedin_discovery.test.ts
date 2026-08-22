import test from "node:test";
import assert from "node:assert/strict";
import { linkedinDiscoveryService } from "../src/services/linkedinDiscoveryService";
import { opportunityVerificationService } from "../src/services/opportunityVerificationService";
import { opportunityRepository } from "../src/repositories/opportunityRepository";
import { opportunityService } from "../src/services/opportunityService";
import type { SourceProvenanceType, SourceType, DiscoveryCandidate } from "../src/types";

// 1. LinkedIn Discovery-Only Source Classification
test("LinkedIn Test 1: SourceType includes 'discovery_only' and LinkedIn signals are strictly marked discovery_only", async () => {
  linkedinDiscoveryService.resetToSeed();
  const candidates = linkedinDiscoveryService.getAllCandidates();
  assert.ok(candidates.length > 0, "Seed discovery candidates present");

  for (const c of candidates) {
    assert.equal(c.sourceType, "discovery_only", `Candidate [${c.id}] must have sourceType = 'discovery_only'`);
    assert.notEqual(c.sourceType, "official", `Candidate [${c.id}] must NEVER be labeled as official`);
    assert.equal(c.discoveredFrom, "LinkedIn");
  }
});

// 2. Zero URL Fabrication & Verbatim LinkedIn Source URL Preservation
test("LinkedIn Test 2: Candidate creation preserves exact LinkedIn URL with zero fabricated /apply, /register, or PDF URLs", async () => {
  linkedinDiscoveryService.resetToSeed();
  const testLinkedInUrl = "https://www.linkedin.com/posts/accredited-org_tech-challenge-2026-activity-8923749281729384712";
  const { added } = await linkedinDiscoveryService.discoverSignals([
    {
      title: "Accredited National Innovation Challenge 2026",
      organization: "National Org",
      sourceUrl: testLinkedInUrl,
      announcementText: "Announcement text without official apply link",
      claimedDeadline: "2026-11-15",
    },
  ]);

  assert.equal(added.length, 1);
  const candidate = added[0];
  assert.equal(candidate.sourceUrl, testLinkedInUrl, "Verbatim LinkedIn URL must be stored exact");
  assert.equal(candidate.officialApplyUrl, undefined, "Apply URL must NOT be guessed or fabricated");
  assert.equal(candidate.officialRulesPdfUrl, undefined, "PDF URL must NOT be guessed or fabricated");
  assert.equal(candidate.verificationStatus, "pending", "New discovery candidate must start as pending");
  assert.equal(candidate.sourceType, "discovery_only");
});

// 3. Provenance Integrity: LinkedIn Cannot Become Canonical Source of Truth
test("LinkedIn Test 3: LinkedIn URL is rejected as officialUrl, officialSourceUrl, or rulesPdfUrl", async () => {
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://www.linkedin.com/posts/tech-challenge"), false);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://linkedin.com/jobs/view/123456"), false);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://linkedin.com/in/recruiter"), false);
  assert.equal(opportunityVerificationService.isValidApplicationUrl("https://linkedin.com/posts/apply-now"), false);
});

// 4. Draft Isolation: Unverified Discovery Candidates Excluded from Active Feed
test("LinkedIn Test 4: Unverified discovery candidates remain pending/draft and are strictly excluded from getActiveOpportunities", async () => {
  linkedinDiscoveryService.resetToSeed();
  const unverifiedCandidate = linkedinDiscoveryService.getCandidateById("disc-linkedin-unverified-bootcamp");
  assert.ok(unverifiedCandidate);
  assert.equal(unverifiedCandidate.verificationStatus, "pending");

  const activeOpps = await opportunityService.getActiveOpportunities();
  assert.ok(
    !activeOpps.some((o) => o.title.includes("Global Student Tech Challenge 2026")),
    "Unverified LinkedIn discovery candidate must NEVER appear in active opportunities feed"
  );
});

// 5. Official Source Verification & Publication Lifecycle
test("LinkedIn Test 5: Official Source Verification discovers canonical domain and produces verified published opportunity", async () => {
  linkedinDiscoveryService.resetToSeed();
  const res = await linkedinDiscoveryService.verifyOfficialSourceForCandidate(
    "disc-linkedin-sih-2026",
    "https://www.sih.gov.in"
  );

  assert.equal(res.verified, true);
  assert.ok(res.verifiedOpportunity);
  assert.equal(res.verifiedOpportunity.verificationStatus, "verified");
  assert.equal(res.verifiedOpportunity.lifecycleStatus, "published");
  assert.equal(res.verifiedOpportunity.officialUrl, "https://www.sih.gov.in");
  assert.equal(res.verifiedOpportunity.sourceUrl, res.candidate.sourceUrl); // Preserves discovery source for audit
  assert.ok(res.verifiedOpportunity.deadlineSource);
  assert.equal((res.verifiedOpportunity.deadlineSource as any).sourceType, "official");
});

// 6. Conflict Resolution: Official Source Overrides LinkedIn Claimed Deadline
test("LinkedIn Test 6: Conflict Resolution Engine prioritizes official deadline over LinkedIn announcement and logs discrepancy", async () => {
  linkedinDiscoveryService.resetToSeed();
  const candidate = linkedinDiscoveryService.getCandidateById("disc-linkedin-meity-quantum-2026");
  assert.ok(candidate);
  assert.equal(candidate.candidateDeadline, "2026-09-20");

  const res = await linkedinDiscoveryService.verifyOfficialSourceForCandidate(
    "disc-linkedin-meity-quantum-2026",
    "https://www.meity.gov.in"
  );

  assert.equal(res.verified, true);
  assert.equal(res.conflictDetected, true);
  assert.equal(res.candidate.sourceConflict, true);
  assert.equal(res.verifiedOpportunity?.deadline, "2026-09-18", "Official source deadline (Sept 18) must win over LinkedIn (Sept 20)");
  assert.ok(res.conflictDetails?.includes("Official source deadline (2026-09-18) prioritized over LinkedIn announcement deadline (2026-09-20)"));
});

// 7. Partner Source Priority Rule: Partner Cannot Override Official Source
test("LinkedIn Test 7: Partner source cannot override official source during conflict resolution", async () => {
  const comparison = opportunityVerificationService.compareAndResolveSources(
    { deadline: "2026-09-18", url: "https://www.meity.gov.in" },
    { deadline: "2026-09-22", url: "https://unstop.com/hackathons/meity-fellowship" }
  );

  assert.equal(comparison.hasConflict, true);
  assert.equal(comparison.resolvedDeadline, "2026-09-18", "Official source deadline must strictly win over partner");
  assert.equal(comparison.sourceType, "official");
  assert.equal(comparison.verificationStatus, "verified");
});

// 8. Rate Limit & Safety Handling: Discovery Service Fails Gracefully
test("LinkedIn Test 8: Discovery service respects rate limits safely without modifying existing catalog records", async () => {
  linkedinDiscoveryService.resetToSeed();
  const initialCount = (await opportunityRepository.getAll()).length;

  // Exhaust rate limit by sending bursts
  const burstPayload = Array.from({ length: 15 }, (_, i) => ({
    title: `Burst Signal ${i}`,
    sourceUrl: `https://www.linkedin.com/posts/burst-${i}`,
  }));

  const res = await linkedinDiscoveryService.discoverSignals(burstPayload);
  assert.equal(res.rateLimited, true, "Discovery service must trigger rate limit protection");

  // Repository remains untouched
  const finalCount = (await opportunityRepository.getAll()).length;
  assert.equal(finalCount, initialCount, "Catalog repository must remain completely untouched on rate limit");
});

// 9. Non-Destruction: Existing Verified Data is Never Replaced by Unverified Discovery Candidate
test("LinkedIn Test 9: Existing verified records in repository are never replaced or corrupted by discovery signals", async () => {
  linkedinDiscoveryService.resetToSeed();
  const verifiedMeity = await opportunityRepository.getById("real-meity-2026-002");
  assert.ok(verifiedMeity);
  assert.equal(verifiedMeity.verificationStatus, "verified");
  assert.equal(verifiedMeity.deadline, "2026-09-15");

  // Attempt discovery with conflicting unverified data
  await linkedinDiscoveryService.discoverSignals([
    {
      title: "MeitY Fake Fellowship Rumor",
      organization: "MeitY",
      sourceUrl: "https://www.linkedin.com/posts/rumor-meity-fellowship-2026",
      claimedDeadline: "2026-12-31",
    },
  ]);

  // Existing verified MeitY record in repository remains pristine
  const intactMeity = await opportunityRepository.getById("real-meity-2026-002");
  assert.ok(intactMeity);
  assert.equal(intactMeity.verificationStatus, "verified");
  assert.equal(intactMeity.deadline, "2026-09-15", "Official verified deadline must never be mutated by discovery signal");
});

// 10. Rejection of Unverified Discovery Candidates
test("LinkedIn Test 10: rejectCandidate updates candidate status to rejected with audit notes", async () => {
  linkedinDiscoveryService.resetToSeed();
  const rejected = linkedinDiscoveryService.rejectCandidate(
    "disc-linkedin-unverified-bootcamp",
    "No official accreditation found."
  );

  assert.ok(rejected);
  assert.equal(rejected.verificationStatus, "rejected");
  assert.ok(rejected.notes?.includes("Rejected: No official accreditation found."));
});

// 11. Zero Guessed Application or PDF URLs Across All Discovery Signals
test("LinkedIn Test 11: All candidate signals contain ZERO generated /apply, /register, or guessed PDF URLs", async () => {
  linkedinDiscoveryService.resetToSeed();
  const candidates = linkedinDiscoveryService.getAllCandidates();
  for (const c of candidates) {
    if (c.officialApplyUrl) {
      assert.ok(
        !c.officialApplyUrl.endsWith("/apply") &&
        !c.officialApplyUrl.endsWith("/register") &&
        !c.officialApplyUrl.endsWith(".pdf"),
        `Candidate [${c.id}] must not have guessed apply URL`
      );
    }
    if (c.officialRulesPdfUrl) {
      assert.ok(
        c.officialRulesPdfUrl.startsWith("http") && !c.officialRulesPdfUrl.includes("/guessed/"),
        `Candidate [${c.id}] must not have guessed PDF URL`
      );
    }
  }
});
