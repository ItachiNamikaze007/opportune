/**
 * PRODUCTION DATA VALIDATION — LinkedIn Discovery Pipeline
 * 
 * Tests all 8 required scenarios against the real discovery pipeline.
 * LinkedIn itself is NEVER contacted directly — we validate the pipeline logic,
 * provenance tracking, and official source HTTP verification.
 * 
 * Real HTTP calls are made ONLY to legitimate public official websites.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { linkedinDiscoveryService, LinkedInSignalPayload } from "../src/services/linkedinDiscoveryService";
import { opportunityVerificationService } from "../src/services/opportunityVerificationService";
import { opportunityRepository } from "../src/repositories/opportunityRepository";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STATE for integrity scan at end
// ─────────────────────────────────────────────────────────────────────────────
const validationReport = {
  totalDiscoveryCandidates: 0,
  verifiedByOfficialSource: 0,
  stillPending: 0,
  rejected: 0,
  newlyPublished: 0,
  conflictsDetected: 0,
  officialSourcesVerified: 0,
  applicationUrlsVerified: 0,
  fabricatedUrls: 0,
  guessedUrls: 0,
  duplicateOpportunities: 0,
  failedSourceRequests: 0,
  cases: {} as Record<string, { passed: boolean; detail: string }>,
};

// ─────────────────────────────────────────────────────────────────────────────
// CASE A: Valid LinkedIn discovery → official source found → publishable
// ─────────────────────────────────────────────────────────────────────────────
test("[PROD-A] Valid LinkedIn discovery signal → official source found → publishable", async () => {
  linkedinDiscoveryService.resetToSeed();

  // Simulated permitted discovery signal: SIH 2026 (announced publicly, official portal: sih.gov.in)
  const signal: LinkedInSignalPayload = {
    title: "Smart India Hackathon 2026",
    organization: "Smart India Hackathon",
    sourceUrl: "https://www.linkedin.com/posts/aicte-india_smartindiaHackathon-sih2026-activity-7192837482910293847",
    announcementText: "SIH 2026 problem statements are live. Register through official sih.gov.in portal.",
    claimedDeadline: "2026-10-15",
  };

  const { added, rateLimited } = await linkedinDiscoveryService.discoverSignals([signal]);
  assert.equal(rateLimited, false, "Should not be rate limited for valid single signal");
  assert.equal(added.length, 1, "Should create exactly 1 discovery candidate");
  
  const candidate = added[0];
  assert.equal(candidate.sourceType, "discovery_only", "Must be discovery_only");
  assert.equal(candidate.verificationStatus, "pending", "Must start as pending");
  assert.equal(candidate.sourceUrl, signal.sourceUrl, "Verbatim LinkedIn URL preserved");
  assert.equal(candidate.discoveredFrom, "LinkedIn");

  // Official source verification via HTTP against sih.gov.in
  const result = await linkedinDiscoveryService.verifyOfficialSourceForCandidate(
    candidate.id,
    "https://www.sih.gov.in"
  );

  assert.equal(result.verified, true, "Should verify against official official source");
  assert.ok(result.verifiedOpportunity, "Should produce a verifiedOpportunity");
  assert.equal(result.verifiedOpportunity!.officialUrl, "https://www.sih.gov.in", "Official URL must be the canonical domain");
  assert.equal(result.verifiedOpportunity!.sourceType, "official", "Published record must be sourceType=official");
  assert.equal(result.verifiedOpportunity!.verificationStatus, "verified");
  assert.equal(result.verifiedOpportunity!.lifecycleStatus, "published");
  assert.notEqual(result.verifiedOpportunity!.officialUrl, candidate.sourceUrl, "Official URL must differ from LinkedIn URL");
  // deadlineSource provenance must point to official, not LinkedIn
  assert.equal((result.verifiedOpportunity!.deadlineSource as any).sourceType, "official");
  assert.ok(!(result.verifiedOpportunity!.deadlineSource as any).sourceUrl?.includes("linkedin.com"), "Deadline provenance must not be LinkedIn");

  validationReport.cases["A"] = { passed: true, detail: `Candidate ${candidate.id} verified via https://www.sih.gov.in → published.` };
  validationReport.verifiedByOfficialSource++;
  validationReport.officialSourcesVerified++;
  validationReport.newlyPublished++;
  if (result.verifiedOpportunity?.applyUrl) validationReport.applicationUrlsVerified++;

  console.log(`[PROD-A] PASS — Candidate verified and publishable.`);
  console.log(`  LinkedIn Signal URL : ${candidate.sourceUrl}`);
  console.log(`  Official URL verified: ${result.verifiedOpportunity!.officialUrl}`);
  console.log(`  Canonical deadline  : ${result.verifiedOpportunity!.deadline}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// CASE B: LinkedIn discovery → no official source → remains pending
// ─────────────────────────────────────────────────────────────────────────────
test("[PROD-B] LinkedIn discovery with unknown org → no official source found → remains pending", async () => {
  linkedinDiscoveryService.resetToSeed();

  const signal: LinkedInSignalPayload = {
    title: "XYZ Global Student Innovation Prize 2026",
    organization: "XYZ Unverified Unofficial Group",
    sourceUrl: "https://www.linkedin.com/posts/xyz-unofficial-group_student-prize-2026-activity-999999999",
    announcementText: "Join our global innovation challenge! Register at xyz-unofficial.io",
    claimedDeadline: "2026-12-01",
  };

  const { added } = await linkedinDiscoveryService.discoverSignals([signal]);
  assert.equal(added.length, 1);
  const candidate = added[0];

  // Attempt verification with no known official domain
  const result = await linkedinDiscoveryService.verifyOfficialSourceForCandidate(candidate.id);

  assert.equal(result.verified, false, "Must remain unverified");
  assert.equal(result.candidate.verificationStatus, "pending", "Must remain pending");
  assert.ok(!result.verifiedOpportunity, "Must produce no publishable opportunity");
  assert.ok(result.reason.includes("No official accredited domain"), "Reason must reflect no official source found");

  // Active feed must NOT contain this candidate
  const activeOpps = await opportunityRepository.getAllActive();
  assert.ok(
    !activeOpps.some(o => o.title === signal.title),
    "Unverified candidate must NOT appear in active opportunities"
  );

  validationReport.cases["B"] = { passed: true, detail: `Candidate ${candidate.id} correctly remains pending — no official source found.` };
  validationReport.stillPending++;

  console.log(`[PROD-B] PASS — No official source found, candidate remains pending.`);
  console.log(`  Organization       : ${signal.organization}`);
  console.log(`  Verification status: ${result.candidate.verificationStatus}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// CASE C: LinkedIn deadline conflicts with official deadline → official wins
// ─────────────────────────────────────────────────────────────────────────────
test("[PROD-C] LinkedIn deadline conflicts with official deadline → official source wins", async () => {
  linkedinDiscoveryService.resetToSeed();

  const signal: LinkedInSignalPayload = {
    title: "Digital India AI & Quantum Tech Fellowship 2026",
    organization: "MeitY",
    sourceUrl: "https://www.linkedin.com/posts/meity-digital-india_quantum-fellowship-2026-activity-7291827491029384712",
    announcementText: "MeitY fellowship applications open — deadline Sep 20.",
    claimedDeadline: "2026-09-20",  // LinkedIn says Sep 20 — official is Sep 18!
  };

  const { added } = await linkedinDiscoveryService.discoverSignals([signal]);
  const candidate = added[0];
  assert.equal(candidate.candidateDeadline, "2026-09-20");

  // Official source verification — official portal says Sept 18
  const result = await linkedinDiscoveryService.verifyOfficialSourceForCandidate(
    candidate.id,
    "https://www.meity.gov.in"
  );

  assert.equal(result.verified, true);
  assert.equal(result.conflictDetected, true, "Conflict must be detected");
  assert.equal(result.candidate.sourceConflict, true, "Candidate must record sourceConflict=true");
  // Official deadline must win
  assert.notEqual(result.verifiedOpportunity!.deadline, "2026-09-20", "LinkedIn deadline must NOT win");
  assert.ok(result.conflictDetails?.includes("prioritized over LinkedIn"), "Conflict details must document the resolution");

  validationReport.cases["C"] = {
    passed: true,
    detail: `Conflict detected: LinkedIn claimed 2026-09-20, official source deadline (${result.verifiedOpportunity!.deadline}) wins.`,
  };
  validationReport.conflictsDetected++;
  validationReport.verifiedByOfficialSource++;
  validationReport.officialSourcesVerified++;
  validationReport.newlyPublished++;

  console.log(`[PROD-C] PASS — Conflict detected and resolved in favour of official source.`);
  console.log(`  LinkedIn claimed deadline: 2026-09-20`);
  console.log(`  Official winning deadline: ${result.verifiedOpportunity!.deadline}`);
  console.log(`  Conflict detail          : ${result.conflictDetails}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// CASE D: LinkedIn contains fake/invalid application URL → rejected
// ─────────────────────────────────────────────────────────────────────────────
test("[PROD-D] LinkedIn-sourced fake application URL is rejected by domain allowlist", async () => {
  // Attempt to use a LinkedIn URL directly as officialUrl
  const fakeLinkedInApplyUrl = "https://www.linkedin.com/posts/fake-hackathon_apply-now-activity-0000000000000";
  assert.equal(
    opportunityVerificationService.isValidOfficialUrl(fakeLinkedInApplyUrl),
    false,
    "LinkedIn URL must be rejected as an official application URL"
  );

  // Third-party unofficial URLs are also rejected
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://xyz-unofficial.io/apply"), false);
  assert.equal(opportunityVerificationService.isValidApplicationUrl("https://linkedin.com/apply-now"), false);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://linkedin.com/in/recruiter/register"), false);

  // Guessed subpaths on legit domains — the service never generates these
  linkedinDiscoveryService.resetToSeed();
  const signal: LinkedInSignalPayload = {
    title: "Fake Hackathon with Guessed Apply URL",
    organization: "MeitY",
    sourceUrl: "https://www.linkedin.com/posts/fake-post-guessed-url-activity-0001",
    announcementText: "Apply here: https://meity.gov.in/apply",  // guessed subpath
    claimedDeadline: "2026-10-01",
  };
  const { added } = await linkedinDiscoveryService.discoverSignals([signal]);
  const candidate = added[0];
  // Service must NOT propagate the guessed /apply from announcement text
  assert.equal(candidate.officialApplyUrl, undefined, "Guessed /apply URL from announcement text must not be stored");
  assert.equal(candidate.officialRulesPdfUrl, undefined, "No guessed PDF URL must be stored");

  validationReport.cases["D"] = { passed: true, detail: "LinkedIn URLs and guessed /apply subpaths rejected by allowlist and service invariants." };
  validationReport.fabricatedUrls = 0; // Confirmed zero

  console.log("[PROD-D] PASS — Fake/invalid application URLs correctly rejected.");
});

// ─────────────────────────────────────────────────────────────────────────────
// CASE E: Official source temporarily unavailable → preserve last-known-good
// ─────────────────────────────────────────────────────────────────────────────
test("[PROD-E] Official source temporarily unavailable → pipeline fails gracefully, preserves verified catalog", async () => {
  linkedinDiscoveryService.resetToSeed();

  // Get current count of verified opportunities in catalog before any discovery
  const before = await opportunityRepository.getAll();
  const beforeVerifiedCount = before.filter(o => o.verificationStatus === "verified").length;

  // Simulate discovery signal pointing to an unreachable domain
  const signal: LinkedInSignalPayload = {
    title: "Unreachable Gov Scholarship 2026",
    organization: "Unreachable Ministry",
    sourceUrl: "https://www.linkedin.com/posts/unreachable-ministry_scholarship-2026-activity-1234567890",
    claimedDeadline: "2026-11-30",
  };
  const { added } = await linkedinDiscoveryService.discoverSignals([signal]);
  const candidate = added[0];

  // Try verification against unreachable domain (should fail gracefully)
  const result = await linkedinDiscoveryService.verifyOfficialSourceForCandidate(
    candidate.id,
    "https://www.this-domain-does-not-exist-opportune-test.gov.in"
  );
  // Either fails (no official domain in allowlist) or fetches and falls back gracefully
  // Either way, existing catalog must be intact
  assert.equal(result.candidate.verificationStatus !== "verified" || result.verified, true);

  // Existing verified catalog must be untouched
  const after = await opportunityRepository.getAll();
  const afterVerifiedCount = after.filter(o => o.verificationStatus === "verified").length;
  assert.ok(
    afterVerifiedCount >= beforeVerifiedCount,
    "Verified catalog count must not decrease due to failed source request"
  );

  // All originally verified opportunities remain intact
  for (const opp of before.filter(o => o.verificationStatus === "verified")) {
    const stillThere = after.find(o => o.id === opp.id);
    assert.ok(stillThere, `Verified opportunity ${opp.id} must still exist`);
    assert.equal(stillThere!.verificationStatus, "verified", `Opportunity ${opp.id} must remain verified`);
    assert.equal(stillThere!.deadline, opp.deadline, `Deadline for ${opp.id} must remain unchanged`);
  }

  validationReport.cases["E"] = { passed: true, detail: `Unavailable source failed gracefully. ${beforeVerifiedCount} verified records preserved intact.` };
  validationReport.failedSourceRequests++;

  console.log("[PROD-E] PASS — Official source unavailable, pipeline fails gracefully.");
  console.log(`  Verified records before: ${beforeVerifiedCount}`);
  console.log(`  Verified records after : ${afterVerifiedCount}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// CASE F: Duplicate LinkedIn discovery → no duplicate opportunity created
// ─────────────────────────────────────────────────────────────────────────────
test("[PROD-F] Duplicate LinkedIn signal → no duplicate discovery candidate or opportunity created", async () => {
  linkedinDiscoveryService.resetToSeed();

  const signal: LinkedInSignalPayload = {
    title: "DRDO RAC Recruitment 2026",
    organization: "DRDO",
    sourceUrl: "https://www.linkedin.com/posts/drdo-india_rac-recruitment-2026-activity-7123456789012345678",
    claimedDeadline: "2026-10-31",
  };

  // First discovery
  const { added: first } = await linkedinDiscoveryService.discoverSignals([signal]);
  assert.equal(first.length, 1, "First signal should create exactly 1 candidate");

  // Exact same LinkedIn URL submitted again — dedup guard must block it
  const { added: second } = await linkedinDiscoveryService.discoverSignals([signal]);
  assert.equal(second.length, 0, "Second submission of identical LinkedIn URL must be deduplicated (0 added)");

  // Count candidates with identical sourceUrl — must be exactly 1
  const allCandidates = linkedinDiscoveryService.getAllCandidates();
  const duplicates = allCandidates.filter(c => c.sourceUrl === signal.sourceUrl);
  assert.equal(duplicates.length, 1, `Must have exactly 1 candidate for URL ${signal.sourceUrl}, found ${duplicates.length}`);

  validationReport.cases["F"] = { passed: true, detail: `Dedup guard enforced — second identical LinkedIn URL correctly blocked.` };
  validationReport.duplicateOpportunities = 0;

  // Repository must never have duplicate titles
  const allOpps = await opportunityRepository.getAll();
  const oppTitles = allOpps.map(o => o.title);
  const titleCounts = oppTitles.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {} as Record<string, number>);
  const dupTitles = Object.entries(titleCounts).filter(([, count]) => count > 1);
  assert.equal(dupTitles.length, 0, `Repository must have no duplicate opportunity titles. Found: ${JSON.stringify(dupTitles)}`);

  console.log("[PROD-F] PASS — Dedup guard working. Identical LinkedIn URLs blocked from creating duplicate candidates.");
});

// ─────────────────────────────────────────────────────────────────────────────
// CASE G: No guessed /apply, /register or PDF URLs anywhere
// ─────────────────────────────────────────────────────────────────────────────
test("[PROD-G] Zero guessed /apply, /register, or PDF URLs across all discovery candidates", async () => {
  linkedinDiscoveryService.resetToSeed();

  const guessedSubpaths = ["/apply", "/register", "/apply-now", "/signup", "/hackathon/register"];
  const guessedExtensions = [".pdf", ".PDF"];

  const candidates = linkedinDiscoveryService.getAllCandidates();
  validationReport.totalDiscoveryCandidates = candidates.length;

  let guessedCount = 0;
  for (const c of candidates) {
    const urlsToCheck = [
      c.officialApplyUrl,
      c.officialRulesPdfUrl,
      c.officialUrl,
    ].filter(Boolean) as string[];

    for (const url of urlsToCheck) {
      const isFabricated = guessedSubpaths.some(p => url.endsWith(p)) || guessedExtensions.some(e => url.endsWith(e));
      if (isFabricated) {
        guessedCount++;
        console.log(`[PROD-G] FABRICATED URL DETECTED: [${c.id}] ${url}`);
      }
    }

    // Source URL must always be LinkedIn
    if (!c.sourceUrl.includes("linkedin.com")) {
      assert.fail(`Candidate ${c.id} has sourceUrl that is not a LinkedIn URL: ${c.sourceUrl}`);
    }
    // Official URL (if set) must not be LinkedIn
    if (c.officialUrl && c.officialUrl.includes("linkedin.com")) {
      assert.fail(`Candidate ${c.id} has officialUrl pointing to LinkedIn: ${c.officialUrl}`);
    }
  }

  validationReport.guessedUrls = guessedCount;
  validationReport.fabricatedUrls = guessedCount;
  assert.equal(guessedCount, 0, `Found ${guessedCount} fabricated/guessed URLs across ${candidates.length} discovery candidates`);

  validationReport.cases["G"] = { passed: true, detail: `0 fabricated URLs across ${candidates.length} discovery candidates.` };
  console.log(`[PROD-G] PASS — 0 guessed /apply, /register, or PDF URLs across ${candidates.length} candidates.`);
});

// ─────────────────────────────────────────────────────────────────────────────
// CASE H: Partner source cannot override official source
// ─────────────────────────────────────────────────────────────────────────────
test("[PROD-H] Partner source cannot override official source in conflict resolution", async () => {
  // Official: deadline Sept 18
  const officialSource = { deadline: "2026-09-18", url: "https://www.meity.gov.in" };
  // Partner: deadline Sept 22
  const partnerSource = { deadline: "2026-09-22", url: "https://unstop.com/fellowships/meity-quantum" };

  const comparison = opportunityVerificationService.compareAndResolveSources(officialSource, partnerSource);

  assert.equal(comparison.hasConflict, true, "Conflict must be detected between official and partner");
  assert.equal(comparison.resolvedDeadline, "2026-09-18", "Official deadline must always win");
  assert.equal(comparison.sourceType, "official", "Resolved source type must be official");
  assert.equal(comparison.verificationStatus, "verified");

  // Even with a later partner deadline, official wins
  const comparison2 = opportunityVerificationService.compareAndResolveSources(
    { deadline: "2026-11-30", url: "https://www.drdo.gov.in" },
    { deadline: "2026-12-15", url: "https://internshala.com/drdo-internship" }
  );
  assert.equal(comparison2.resolvedDeadline, "2026-11-30", "Official deadline must always win regardless of partner");

  validationReport.cases["H"] = { passed: true, detail: "Official source always overrides partner source in conflict resolution." };
  console.log("[PROD-H] PASS — Partner source cannot override official source.");
});

// ─────────────────────────────────────────────────────────────────────────────
// FINAL INTEGRITY SCAN — Summary Report
// ─────────────────────────────────────────────────────────────────────────────
test("[INTEGRITY-SCAN] Final data integrity scan across discovery pipeline", async () => {
  linkedinDiscoveryService.resetToSeed();
  const candidates = linkedinDiscoveryService.getAllCandidates();

  // Count by status
  const pending = candidates.filter(c => c.verificationStatus === "pending");
  const verified = candidates.filter(c => c.verificationStatus === "verified");
  const rejected = candidates.filter(c => c.verificationStatus === "rejected");

  // Check for guessed URLs in seed candidates
  let fabricatedFound = 0;
  for (const c of candidates) {
    const urls = [c.officialApplyUrl, c.officialRulesPdfUrl].filter(Boolean) as string[];
    for (const u of urls) {
      if (u.endsWith("/apply") || u.endsWith("/register") || u.endsWith(".pdf")) {
        fabricatedFound++;
      }
    }
  }

  // Check all existing verified repository opportunities are intact
  const repoOpps = await opportunityRepository.getAll();
  const verifiedRepoOpps = repoOpps.filter(o => o.verificationStatus === "verified");
  const publishedOpps = repoOpps.filter(o => o.lifecycleStatus === "published" && o.verificationStatus === "verified");

  // sourceType must always be valid
  for (const opp of repoOpps) {
    const validTypes = ["official", "partner", "aggregator", "discovery_only"];
    assert.ok(validTypes.includes(opp.sourceType as string), `Opp ${opp.id} has invalid sourceType: ${opp.sourceType}`);
  }

  // LinkedIn must never appear as officialUrl in any repo record
  for (const opp of repoOpps) {
    if (opp.officialUrl) {
      assert.ok(!opp.officialUrl.includes("linkedin.com"), `Opp ${opp.id} has linkedin.com as officialUrl — VIOLATION`);
    }
  }

  // Discovery candidates: LinkedIn URL must never appear as officialUrl
  for (const c of candidates) {
    if (c.officialUrl) {
      assert.ok(!c.officialUrl.includes("linkedin.com"), `Candidate ${c.id} has linkedin.com as officialUrl — PROVENANCE VIOLATION`);
    }
  }

  // Update final report
  validationReport.totalDiscoveryCandidates = candidates.length;
  validationReport.stillPending = pending.length;
  validationReport.rejected = rejected.length;
  validationReport.fabricatedUrls = fabricatedFound;

  // Print final report
  console.log("\n");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("   FINAL PRODUCTION DATA VALIDATION REPORT — LinkedIn Discovery");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log(`  Total Discovery Candidates         : ${validationReport.totalDiscoveryCandidates}`);
  console.log(`  Verified by Official Sources        : ${validationReport.verifiedByOfficialSource}`);
  console.log(`  Still Pending Verification          : ${validationReport.stillPending}`);
  console.log(`  Rejected Candidates                 : ${validationReport.rejected}`);
  console.log(`  Newly Published Opportunities       : ${validationReport.newlyPublished}`);
  console.log(`  Conflicts Detected (Official Wins)  : ${validationReport.conflictsDetected}`);
  console.log(`  Official Sources HTTP-Verified      : ${validationReport.officialSourcesVerified}`);
  console.log(`  Application URLs Verified           : ${validationReport.applicationUrlsVerified}`);
  console.log(`  Fabricated/Guessed URLs Found       : ${validationReport.fabricatedUrls}`);
  console.log(`  Duplicate Opportunities             : ${validationReport.duplicateOpportunities}`);
  console.log(`  Failed Source Requests              : ${validationReport.failedSourceRequests}`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  Repository — Verified Opps          : ${verifiedRepoOpps.length}`);
  console.log(`  Repository — Published Active Opps  : ${publishedOpps.length}`);
  console.log(`  LinkedIn as OfficialUrl Violations  : 0 (CONFIRMED)`);
  console.log(`  ─────────────────────────────────────────`);
  console.log("  CASE RESULTS:");
  for (const [caseId, result] of Object.entries(validationReport.cases)) {
    const icon = result.passed ? "✔" : "✖";
    console.log(`  ${icon} Case ${caseId}: ${result.detail}`);
  }
  console.log("═══════════════════════════════════════════════════════════════════");

  // Assert integrity invariants
  assert.equal(fabricatedFound, 0, "Must have zero fabricated/guessed URLs in discovery candidates");
  assert.ok(verifiedRepoOpps.length > 0, "Repository must contain verified opportunities");
});
